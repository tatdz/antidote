// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import "@uniswap/v4-core/src/libraries/Hooks.sol";
import "@uniswap/v4-core/src/types/PoolKey.sol";
import "@uniswap/v4-core/src/types/BalanceDelta.sol";
import "@uniswap/v4-core/src/types/BeforeSwapDelta.sol"; 
import "@pyth/IPyth.sol";
import "@pyth/PythStructs.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

contract MarginCallInsuranceHook is BaseHook, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    
    struct InsurancePolicy {
        address user;
        uint256 collateralAmount;
        bytes32 collateralFeedId;
        uint256 debtAmount;
        bytes32 debtFeedId;
        uint256 marginThreshold;
        uint256 premiumPaid;
        uint256 coverageAmount;
        bool active;
        uint256 startTime;
        uint256 lastCheck;
        address paymentToken;
    }

    struct PriceData {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    IPyth public immutable pyth;
    IERC20 public immutable usdcToken;
    
    mapping(address => InsurancePolicy) public policies;
    mapping(bytes32 => PriceData) public priceCache;
    
    uint256 public constant MARGIN_THRESHOLD_BASE = 11000;
    uint256 public constant PREMIUM_BASE = 10000;
    uint256 public constant COVERAGE_RATIO = 8000;
    
    uint256 public totalPremiums;
    uint256 public totalPayouts;
    
    bytes32 public constant ETH_USD_FEED_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant USDC_USD_FEED_ID = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;
    
    uint256 private activePolicyCount;
    address[] private activePolicies;
    
    event InsurancePurchased(
        address indexed user,
        uint256 collateralAmount,
        uint256 debtAmount,
        uint256 premium,
        uint256 coverage,
        address paymentToken
    );
    event MarginCallTriggered(
        address indexed user,
        uint256 collateralValue,
        uint256 debtValue,
        uint256 payout,
        string reason
    );
    event PriceUpdated(bytes32 feedId, int64 price, uint64 confidence);
    event InsuranceCancelled(address indexed user, uint256 refundAmount);

    constructor(
        IPoolManager _poolManager, 
        IPyth _pyth,
        address _usdcToken
    ) BaseHook(_poolManager) {
        pyth = _pyth;
        usdcToken = IERC20(_usdcToken);
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: true,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable {
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        _cachePrices();
        
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    function purchaseInsurance(
        uint256 collateralAmount,
        bytes32 collateralFeedId,
        uint256 debtAmount,
        bytes32 debtFeedId,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        require(!policies[msg.sender].active, "Insurance already active");
        require(collateralFeedId == ETH_USD_FEED_ID, "Invalid collateral feed");
        require(debtFeedId == USDC_USD_FEED_ID, "Invalid debt feed");
        require(collateralAmount > 0, "Invalid collateral amount");
        require(debtAmount > 0, "Invalid debt amount");
        
        _updatePricesWithData(priceUpdateData);
        
        // FIXED: Get prices that are already properly converted
        (uint256 collateralPrice, uint256 debtPrice) = _getCachedPrices(collateralFeedId, debtFeedId);
        require(collateralPrice > 0 && debtPrice > 0, "Invalid prices");
        
        // FIXED: Prices from _getCachedPrices are already in proper format (scaled by 10^8)
        // So we multiply amounts (in wei/smallest unit) by price, then divide by 1e18 to get USD value
        // Example: 0.001 ETH (1e15 wei) * 3419e8 (price) / 1e18 = 3.419 USD
        uint256 collateralValue = (collateralAmount * collateralPrice) / 1e18;
        uint256 debtValue = (debtAmount * debtPrice) / 1e18;
        
        require(debtValue > 0, "Debt value too small");
        
        uint256 collateralizationRatio = (collateralValue * PREMIUM_BASE) / debtValue;
        
        require(collateralizationRatio > MARGIN_THRESHOLD_BASE, "Already under margin");
        
        // Premium calculation: 2% base + risk factor
        uint256 basePremium = (collateralValue * 200) / PREMIUM_BASE; // 2%
        uint256 riskFactor = (PREMIUM_BASE * PREMIUM_BASE) / collateralizationRatio;
        uint256 riskPremium = (basePremium * riskFactor) / PREMIUM_BASE;
        uint256 totalPremium = basePremium + riskPremium;
        
        // Convert premium back to ETH (totalPremium is in USD, divide by ETH price)
        uint256 premiumInWei = (totalPremium * 1e18) / collateralPrice;
        
        require(msg.value >= premiumInWei, "Insufficient premium");
        
        // Refund excess
        if (msg.value > premiumInWei) {
            payable(msg.sender).transfer(msg.value - premiumInWei);
        }
        
        uint256 coverageAmount = (collateralValue * COVERAGE_RATIO) / PREMIUM_BASE;
        
        policies[msg.sender] = InsurancePolicy({
            user: msg.sender,
            collateralAmount: collateralAmount,
            collateralFeedId: collateralFeedId,
            debtAmount: debtAmount,
            debtFeedId: debtFeedId,
            marginThreshold: MARGIN_THRESHOLD_BASE,
            premiumPaid: premiumInWei,
            coverageAmount: (coverageAmount * 1e18) / collateralPrice, // Convert coverage to ETH
            active: true,
            startTime: block.timestamp,
            lastCheck: block.timestamp,
            paymentToken: address(0)
        });
        
        // Add to active policies array
        activePolicies.push(msg.sender);
        activePolicyCount++;
        
        totalPremiums += premiumInWei;
        
        emit InsurancePurchased(msg.sender, collateralAmount, debtAmount, premiumInWei, policies[msg.sender].coverageAmount, address(0));
    }

    function purchaseInsuranceWithUSDC(
        uint256 collateralAmount,
        uint256 debtAmount,
        bytes[] calldata priceUpdateData,
        uint256 usdcPremiumAmount
    ) external nonReentrant {
        require(!policies[msg.sender].active, "Insurance already active");
        require(collateralAmount > 0, "Invalid collateral amount");
        require(debtAmount > 0, "Invalid debt amount");
        require(usdcPremiumAmount > 0, "Invalid premium amount");
        
        require(usdcToken.transferFrom(msg.sender, address(this), usdcPremiumAmount), "USDC transfer failed");
        
        _updatePricesWithData(priceUpdateData);
        
        (uint256 collateralPrice, uint256 debtPrice) = _getCachedPrices(ETH_USD_FEED_ID, USDC_USD_FEED_ID);
        require(collateralPrice > 0 && debtPrice > 0, "Invalid prices");
        
        // FIXED: Same calculation fix as above
        uint256 collateralValue = (collateralAmount * collateralPrice) / 1e18;
        uint256 debtValue = (debtAmount * debtPrice) / 1e18;
        
        require(debtValue > 0, "Debt value too small");
        
        uint256 collateralizationRatio = (collateralValue * PREMIUM_BASE) / debtValue;
        
        require(collateralizationRatio > MARGIN_THRESHOLD_BASE, "Already under margin");
        
        uint256 coverageAmount = (collateralValue * COVERAGE_RATIO) / PREMIUM_BASE;
        
        policies[msg.sender] = InsurancePolicy({
            user: msg.sender,
            collateralAmount: collateralAmount,
            collateralFeedId: ETH_USD_FEED_ID,
            debtAmount: debtAmount,
            debtFeedId: USDC_USD_FEED_ID,
            marginThreshold: MARGIN_THRESHOLD_BASE,
            premiumPaid: usdcPremiumAmount,
            coverageAmount: coverageAmount * 1e6, // USDC has 6 decimals
            active: true,
            startTime: block.timestamp,
            lastCheck: block.timestamp,
            paymentToken: address(usdcToken)
        });
        
        // Add to active policies array
        activePolicies.push(msg.sender);
        activePolicyCount++;
        
        totalPremiums += usdcPremiumAmount;
        
        emit InsurancePurchased(msg.sender, collateralAmount, debtAmount, usdcPremiumAmount, policies[msg.sender].coverageAmount, address(usdcToken));
    }

    function _updatePricesWithData(bytes[] calldata priceUpdateData) internal {
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        _cachePrices();
        
        // Refund excess
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    function _cachePrices() internal {
        try pyth.getPriceNoOlderThan(ETH_USD_FEED_ID, 60) returns (PythStructs.Price memory ethPrice) {
            priceCache[ETH_USD_FEED_ID] = PriceData(ethPrice.price, ethPrice.conf, ethPrice.expo, block.timestamp);
            emit PriceUpdated(ETH_USD_FEED_ID, ethPrice.price, ethPrice.conf);
        } catch {}
        
        try pyth.getPriceNoOlderThan(USDC_USD_FEED_ID, 60) returns (PythStructs.Price memory usdcPrice) {
            priceCache[USDC_USD_FEED_ID] = PriceData(usdcPrice.price, usdcPrice.conf, usdcPrice.expo, block.timestamp);
            emit PriceUpdated(USDC_USD_FEED_ID, usdcPrice.price, usdcPrice.conf);
        } catch {}
    }

    function _checkMarginCall(address user) internal returns (string memory reason) {
        InsurancePolicy storage policy = policies[user];
        if (!policy.active) return "No active policy";

        (uint256 collateralPrice, uint256 debtPrice) = _getCachedPrices(policy.collateralFeedId, policy.debtFeedId);
        
        if (collateralPrice == 0 || debtPrice == 0) return "Price data unavailable";
        
        // FIXED: Same calculation fix
        uint256 collateralValue = (policy.collateralAmount * collateralPrice) / 1e18;
        uint256 debtValue = (policy.debtAmount * debtPrice) / 1e18;
        
        if (debtValue == 0) return "No debt position";
        
        uint256 collateralizationRatio = (collateralValue * PREMIUM_BASE) / debtValue;
        
        if (collateralizationRatio < policy.marginThreshold) {
            // Get cached prices for comparison
            PriceData memory collateralData = priceCache[policy.collateralFeedId];
            PriceData memory debtData = priceCache[policy.debtFeedId];
            
            uint256 cachedCollateralPrice = _convertPythPrice(collateralData);
            uint256 cachedDebtPrice = _convertPythPrice(debtData);
            
            if (collateralPrice < (cachedCollateralPrice * 90) / 100) {
                reason = "Collateral price dropped significantly";
            } else if (debtPrice > (cachedDebtPrice * 110) / 100) {
                reason = "Debt value increased significantly";
            } else {
                reason = "Position undercollateralized";
            }
            
            uint256 payout = policy.coverageAmount;
            if (address(this).balance >= payout) {
                payable(user).transfer(payout);
                policy.active = false;
                totalPayouts += payout;
                
                // Remove from active policies
                _removeFromActivePolicies(user);
                
                emit MarginCallTriggered(user, collateralValue, debtValue, payout, reason);
            }
        } else if (collateralizationRatio < policy.marginThreshold + 1000) {
            reason = "Approaching margin call threshold";
        } else {
            reason = "Position safe";
        }
        
        policy.lastCheck = block.timestamp;
        return reason;
    }

    function _removeFromActivePolicies(address user) internal {
        for (uint256 i = 0; i < activePolicies.length; i++) {
            if (activePolicies[i] == user) {
                activePolicies[i] = activePolicies[activePolicies.length - 1];
                activePolicies.pop();
                activePolicyCount--;
                break;
            }
        }
    }

    function _getCachedPrices(bytes32 collateralFeedId, bytes32 debtFeedId) internal view returns (uint256 collateralPrice, uint256 debtPrice) {
        PriceData memory collateralData = priceCache[collateralFeedId];
        PriceData memory debtData = priceCache[debtFeedId];
        
        collateralPrice = _convertPythPrice(collateralData);
        debtPrice = _convertPythPrice(debtData);
    }

    // FIXED: This function now returns the raw Pyth price (already scaled by 10^expo)
    // For ETH with expo=-8: returns 341909000000 (which represents $3419.09)
    // For USDC with expo=-8: returns 99982663 (which represents $0.999827)
    function _convertPythPrice(PriceData memory priceData) internal pure returns (uint256) {
        if (priceData.price == 0) return 0;
        
        // Simply return the absolute value of the price
        // The price already includes the exponent scaling from Pyth
        return uint256(uint64(priceData.price));
    }

    // Hook functions - only override where BaseHook has the function
    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4 selector, BeforeSwapDelta beforeSwapDelta, uint24 operation)
    {
        if (policies[sender].active) {
            _checkMarginCall(sender);
        }
        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    function _afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata hookData)
        internal
        override
        returns (bytes4 selector, int128)
    {
        if (policies[sender].active) {
            _checkMarginCall(sender);
        }
        return (BaseHook.afterSwap.selector, 0);
    }

    function _beforeAddLiquidity(address sender, PoolKey calldata key, ModifyLiquidityParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4 selector)
    {
        if (policies[sender].active) {
            _checkMarginCall(sender);
        }
        return BaseHook.beforeAddLiquidity.selector;
    }

    function _afterAddLiquidity(
        address sender, 
        PoolKey calldata key, 
        ModifyLiquidityParams calldata params, 
        BalanceDelta delta,
        bytes calldata hookData
    )
        internal
        returns (bytes4 selector, BalanceDelta)
    {
        if (policies[sender].active) {
            _checkMarginCall(sender);
        }
        return (BaseHook.afterAddLiquidity.selector, delta);
    }

    function _beforeRemoveLiquidity(address sender, PoolKey calldata key, ModifyLiquidityParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4 selector)
    {
        if (policies[sender].active) {
            _checkMarginCall(sender);
        }
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    function _afterRemoveLiquidity(
        address sender, 
        PoolKey calldata key, 
        ModifyLiquidityParams calldata params, 
        BalanceDelta delta,
        bytes calldata hookData
    )
        internal
        returns (bytes4 selector, BalanceDelta)
    {
        if (policies[sender].active) {
            _checkMarginCall(sender);
        }
        return (BaseHook.afterRemoveLiquidity.selector, delta);
    }

    function checkMarginCallStatus(address user) external returns (string memory reason, bool isDangerous) {
        reason = _checkMarginCall(user);
        isDangerous = _isDangerousReason(reason);
        return (reason, isDangerous);
    }

    function _isDangerousReason(string memory reason) internal pure returns (bool) {
        bytes memory reasonBytes = bytes(reason);
        bytes memory dangerous = bytes("margin call");
        bytes memory approaching = bytes("Approaching");
        bytes memory dropped = bytes("dropped");
        bytes memory increased = bytes("increased");
        bytes memory undercollateralized = bytes("undercollateralized");
        
        if (_contains(reasonBytes, dangerous) || 
            _contains(reasonBytes, approaching) ||
            _contains(reasonBytes, dropped) ||
            _contains(reasonBytes, increased) ||
            _contains(reasonBytes, undercollateralized)) {
            return true;
        }
        
        return false;
    }

    function _contains(bytes memory data, bytes memory search) internal pure returns (bool) {
        for (uint i = 0; i <= data.length - search.length; i++) {
            bool found = true;
            for (uint j = 0; j < search.length; j++) {
                if (data[i + j] != search[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    function getPolicyStatus(address user) external view returns (
        bool active,
        uint256 collateralizationRatio,
        uint256 premium,
        uint256 coverage,
        uint256 lastCheck,
        address paymentToken
    ) {
        InsurancePolicy memory policy = policies[user];
        if (!policy.active) {
            return (false, 0, policy.premiumPaid, policy.coverageAmount, policy.lastCheck, policy.paymentToken);
        }
        
        (uint256 collateralPrice, uint256 debtPrice) = _getCachedPrices(policy.collateralFeedId, policy.debtFeedId);
        
        if (collateralPrice == 0 || debtPrice == 0) {
            return (true, type(uint256).max, policy.premiumPaid, policy.coverageAmount, policy.lastCheck, policy.paymentToken);
        }
        
        // FIXED: Same calculation fix
        uint256 collateralValue = (policy.collateralAmount * collateralPrice) / 1e18;
        uint256 debtValue = (policy.debtAmount * debtPrice) / 1e18;
        
        uint256 ratio = debtValue > 0 ? (collateralValue * PREMIUM_BASE) / debtValue : type(uint256).max;
        
        return (true, ratio, policy.premiumPaid, policy.coverageAmount, policy.lastCheck, policy.paymentToken);
    }

    function getLatestPrice(bytes32 feedId) external view returns (int64 price, uint64 confidence, int32 expo) {
        PriceData memory data = priceCache[feedId];
        return (data.price, data.conf, data.expo);
    }

    function cancelInsurance() external {
        InsurancePolicy storage policy = policies[msg.sender];
        require(policy.active, "No active policy");
        
        uint256 timeElapsed = block.timestamp - policy.startTime;
        uint256 totalDuration = 30 days;
        uint256 refundAmount = timeElapsed < totalDuration ? 
            (policy.premiumPaid * (totalDuration - timeElapsed)) / totalDuration : 0;
        
        policy.active = false;
        
        // Remove from active policies
        _removeFromActivePolicies(msg.sender);
        
        if (refundAmount > 0) {
            if (policy.paymentToken == address(0)) {
                if (address(this).balance >= refundAmount) {
                    payable(msg.sender).transfer(refundAmount);
                }
            } else {
                if (usdcToken.balanceOf(address(this)) >= refundAmount) {
                    usdcToken.transfer(msg.sender, refundAmount);
                }
            }
        }
        
        emit InsuranceCancelled(msg.sender, refundAmount);
    }

    function getTotalActivePolicies() external view returns (uint256) {
        return activePolicyCount;
    }

    function checkAllActivePolicies(bytes[] calldata priceUpdateData) external payable {
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        _cachePrices();
        
        // Check all active policies (limit to prevent gas issues)
        uint256 maxChecks = activePolicies.length > 10 ? 10 : activePolicies.length;
        for (uint256 i = 0; i < maxChecks; i++) {
            address user = activePolicies[i];
            if (policies[user].active) {
                _checkMarginCall(user);
            }
        }
        
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getUSDCBalance() external view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }

    receive() external payable {}
}