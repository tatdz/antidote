pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRiskToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function getTokenPrice() external view returns (uint256); // ADD THIS LINE
}

interface IMarginCallInsuranceHook {
    function getPolicyStatus(address user) external view returns (
        bool active,
        uint256 collateralizationRatio,
        uint256 premium,
        uint256 coverage,
        uint256 lastCheck,
        address paymentToken
    );
    function getTotalActivePolicies() external view returns (uint256);
}

interface IStateView {
    function getPool(address token0, address token1, uint24 fee) external view returns (address pool);
    function getPoolState(address pool) external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex);
}

contract SecondaryMarket is ReentrancyGuard {
    struct Order {
        address user;
        uint128 tokenAmount;
        uint128 price;
        address paymentToken;
        uint32 createdAt;
        bool active;
    }

    struct InsuranceStatus {
        bool hasActivePolicy;
        uint256 collateralizationRatio;
        uint256 coverage;
        uint256 premium;
        address paymentToken;
    }

    struct MarketStats {
        uint32 totalSellOrders;
        uint32 totalBuyOrders;
        uint32 activeSellOrders;
        uint32 activeBuyOrders;
        uint32 totalInsuranceBundles;
    }

    IRiskToken public immutable riskToken;
    IERC20 public immutable usdcToken;
    IMarginCallInsuranceHook public immutable insuranceHook;
    IStateView public immutable stateView;
    
    // Gas-optimized storage layout
    Order[] public sellOrders;
    Order[] public buyOrders;
    
    // Track active order counts without iterating
    uint32 public activeSellOrderCount;
    uint32 public activeBuyOrderCount;
    
    uint16 public constant TRADING_FEE_BPS = 50; // 0.5%
    address public feeRecipient;
    
    // Cache for risk token price to avoid frequent external calls
    uint256 private _cachedRiskTokenPrice;
    uint256 private _priceLastUpdated;
    uint256 private constant PRICE_CACHE_DURATION = 5 minutes;
    
    // Events
    event SellOrderCreated(uint256 orderId, address seller, uint256 tokenAmount, uint256 price, address paymentToken);
    event SellOrderFilled(uint256 orderId, address buyer, uint256 tokenAmount, uint256 totalPrice, address paymentToken);
    event SellOrderCancelled(uint256 orderId);
    event BuyOrderCreated(uint256 orderId, address buyer, uint256 tokenAmount, uint256 price, address paymentToken);
    event BuyOrderFilled(uint256 orderId, address seller, uint256 tokenAmount, uint256 totalPrice, address paymentToken);
    event BuyOrderCancelled(uint256 orderId);
    event RiskTokenPriceUpdated(uint256 price);

    constructor(
        address _riskToken, 
        address _usdcToken,
        address _insuranceHook,
        address _stateView,
        address _feeRecipient
    ) {
        riskToken = IRiskToken(_riskToken);
        usdcToken = IERC20(_usdcToken);
        insuranceHook = IMarginCallInsuranceHook(_insuranceHook);
        stateView = IStateView(_stateView);
        feeRecipient = _feeRecipient;
        
        // Initialize with empty order to avoid 0 index issues
        sellOrders.push(Order(address(0), 0, 0, address(0), 0, false));
        buyOrders.push(Order(address(0), 0, 0, address(0), 0, false));
        
        // Initialize price cache
        _updateRiskTokenPrice();
    }

    function createSellOrder(
        uint128 tokenAmount,
        uint128 price,
        address paymentToken
    ) external nonReentrant returns (uint256 orderId) {
        require(tokenAmount > 0, "Invalid token amount");
        require(price > 0, "Invalid price");
        require(riskToken.balanceOf(msg.sender) >= tokenAmount, "Insufficient tokens");
        require(paymentToken == address(0) || paymentToken == address(usdcToken), "Invalid payment token");

        // Transfer tokens to contract
        require(riskToken.transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed");

        orderId = sellOrders.length;
        sellOrders.push(Order({
            user: msg.sender,
            tokenAmount: tokenAmount,
            price: price,
            paymentToken: paymentToken,
            createdAt: uint32(block.timestamp),
            active: true
        }));
        activeSellOrderCount++;

        emit SellOrderCreated(orderId, msg.sender, tokenAmount, price, paymentToken);
    }

    function fillSellOrder(uint256 orderId) external payable nonReentrant {
        require(orderId > 0 && orderId < sellOrders.length, "Invalid order ID");
        Order storage order = sellOrders[orderId];
        require(order.active, "Order not active");
        require(msg.sender != order.user, "Cannot fill own order");

        // FIXED: Calculate total price correctly - divide by 1e18
        uint256 totalPrice = (uint256(order.tokenAmount) * uint256(order.price)) / 1e18;
        uint256 fee = (totalPrice * TRADING_FEE_BPS) / 10000;
        uint256 sellerAmount = totalPrice - fee;

        if (order.paymentToken == address(0)) {
            require(msg.value >= totalPrice, "Insufficient ETH");
        } else {
            require(usdcToken.transferFrom(msg.sender, address(this), totalPrice), "USDC transfer failed");
        }

        // Transfer tokens to buyer
        require(riskToken.transfer(msg.sender, order.tokenAmount), "Token transfer failed");
        
        // Transfer payment to seller and fee to recipient
        if (order.paymentToken == address(0)) {
            payable(order.user).transfer(sellerAmount);
            if (fee > 0) {
                payable(feeRecipient).transfer(fee);
            }
            // Refund excess ETH
            if (msg.value > totalPrice) {
                payable(msg.sender).transfer(msg.value - totalPrice);
            }
        } else {
            usdcToken.transfer(order.user, sellerAmount);
            if (fee > 0) {
                usdcToken.transfer(feeRecipient, fee);
            }
        }

        order.active = false;
        activeSellOrderCount--;
        emit SellOrderFilled(orderId, msg.sender, order.tokenAmount, totalPrice, order.paymentToken);
    }

    function createBuyOrder(
        uint128 tokenAmount,
        uint128 price,
        address paymentToken
    ) external payable nonReentrant returns (uint256 orderId) {
        require(tokenAmount > 0, "Invalid token amount");
        require(price > 0, "Invalid price");
        require(paymentToken == address(0) || paymentToken == address(usdcToken), "Invalid payment token");
        
        // FIXED: Calculate total price correctly - divide by 1e18
        uint256 totalPrice = (uint256(tokenAmount) * uint256(price)) / 1e18;
        
        if (paymentToken == address(0)) {
            require(msg.value == totalPrice, "Incorrect ETH amount");
        } else {
            require(usdcToken.transferFrom(msg.sender, address(this), totalPrice), "USDC transfer failed");
        }

        orderId = buyOrders.length;
        buyOrders.push(Order({
            user: msg.sender,
            tokenAmount: tokenAmount,
            price: price,
            paymentToken: paymentToken,
            createdAt: uint32(block.timestamp),
            active: true
        }));
        activeBuyOrderCount++;

        emit BuyOrderCreated(orderId, msg.sender, tokenAmount, price, paymentToken);
    }

    function fillBuyOrder(uint256 orderId, uint128 fillAmount) external nonReentrant {
        require(orderId > 0 && orderId < buyOrders.length, "Invalid order ID");
        Order storage order = buyOrders[orderId];
        require(order.active, "Order not active");
        require(msg.sender != order.user, "Cannot fill own order");
        require(fillAmount <= order.tokenAmount, "Amount exceeds order");
        require(riskToken.balanceOf(msg.sender) >= fillAmount, "Insufficient tokens");

        // FIXED: Calculate total price correctly - divide by 1e18
        uint256 totalPrice = (uint256(fillAmount) * uint256(order.price)) / 1e18;
        uint256 fee = (totalPrice * TRADING_FEE_BPS) / 10000;
        uint256 sellerAmount = totalPrice - fee;

        // Transfer tokens to buyer
        require(riskToken.transferFrom(msg.sender, order.user, fillAmount), "Token transfer failed");
        
        // Transfer payment to seller
        if (order.paymentToken == address(0)) {
            payable(msg.sender).transfer(sellerAmount);
            if (fee > 0) {
                payable(feeRecipient).transfer(fee);
            }
        } else {
            usdcToken.transfer(msg.sender, sellerAmount);
            if (fee > 0) {
                usdcToken.transfer(feeRecipient, fee);
            }
        }

        order.tokenAmount -= fillAmount;
        if (order.tokenAmount == 0) {
            order.active = false;
            activeBuyOrderCount--;
        }

        emit BuyOrderFilled(orderId, msg.sender, fillAmount, totalPrice, order.paymentToken);
    }

    function cancelBuyOrder(uint256 orderId) external nonReentrant {
        require(orderId > 0 && orderId < buyOrders.length, "Invalid order ID");
        Order storage order = buyOrders[orderId];
        require(order.active, "Order not active");
        require(msg.sender == order.user, "Only buyer can cancel");

        // FIXED: Calculate refund amount correctly - divide by 1e18
        uint256 refundAmount = (uint256(order.tokenAmount) * uint256(order.price)) / 1e18;
        
        if (order.paymentToken == address(0)) {
            payable(order.user).transfer(refundAmount);
        } else {
            usdcToken.transfer(order.user, refundAmount);
        }

        order.active = false;
        activeBuyOrderCount--;
        emit BuyOrderCancelled(orderId);
    }

    function cancelSellOrder(uint256 orderId) external nonReentrant {
        require(orderId > 0 && orderId < sellOrders.length, "Invalid order ID");
        Order storage order = sellOrders[orderId];
        require(order.active, "Order not active");
        require(msg.sender == order.user, "Only seller can cancel");

        // Return tokens to seller
        require(riskToken.transfer(order.user, order.tokenAmount), "Token return failed");

        order.active = false;
        activeSellOrderCount--;
        emit SellOrderCancelled(orderId);
    }

    // Gas-optimized view functions with pagination
    function getActiveSellOrders(uint256 cursor, uint256 limit) external view returns (Order[] memory orders, uint256 newCursor) {
        uint256 resultCount = 0;
        uint256 length = sellOrders.length;
        
        // Count active orders first to allocate array
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && resultCount < limit; i++) {
            if (sellOrders[i].active) {
                resultCount++;
            }
        }
        
        orders = new Order[](resultCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && currentIndex < resultCount; i++) {
            if (sellOrders[i].active) {
                orders[currentIndex] = sellOrders[i];
                currentIndex++;
            }
            newCursor = i + 1;
        }
    }

    function getActiveBuyOrders(uint256 cursor, uint256 limit) external view returns (Order[] memory orders, uint256 newCursor) {
        uint256 resultCount = 0;
        uint256 length = buyOrders.length;
        
        // Count active orders first to allocate array
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && resultCount < limit; i++) {
            if (buyOrders[i].active) {
                resultCount++;
            }
        }
        
        orders = new Order[](resultCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && currentIndex < resultCount; i++) {
            if (buyOrders[i].active) {
                orders[currentIndex] = buyOrders[i];
                currentIndex++;
            }
            newCursor = i + 1;
        }
    }

    // Simplified user order functions
    function getUserSellOrders(address user, uint256 cursor, uint256 limit) external view returns (uint256[] memory orderIds, uint256 newCursor) {
        uint256 resultCount = 0;
        uint256 length = sellOrders.length;
        
        // Count matching orders first
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && resultCount < limit; i++) {
            if (sellOrders[i].user == user && sellOrders[i].active) {
                resultCount++;
            }
        }
        
        orderIds = new uint256[](resultCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && currentIndex < resultCount; i++) {
            if (sellOrders[i].user == user && sellOrders[i].active) {
                orderIds[currentIndex] = i;
                currentIndex++;
            }
            newCursor = i + 1;
        }
    }

    function getUserBuyOrders(address user, uint256 cursor, uint256 limit) external view returns (uint256[] memory orderIds, uint256 newCursor) {
        uint256 resultCount = 0;
        uint256 length = buyOrders.length;
        
        // Count matching orders first
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && resultCount < limit; i++) {
            if (buyOrders[i].user == user && buyOrders[i].active) {
                resultCount++;
            }
        }
        
        orderIds = new uint256[](resultCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = cursor > 0 ? cursor : 1; i < length && currentIndex < resultCount; i++) {
            if (buyOrders[i].user == user && buyOrders[i].active) {
                orderIds[currentIndex] = i;
                currentIndex++;
            }
            newCursor = i + 1;
        }
    }

    function getMarketStats() external view returns (MarketStats memory) {
        return MarketStats({
            totalSellOrders: uint32(sellOrders.length - 1), // Subtract 1 for initial empty order
            totalBuyOrders: uint32(buyOrders.length - 1),
            activeSellOrders: activeSellOrderCount,
            activeBuyOrders: activeBuyOrderCount,
            totalInsuranceBundles: 0 // Removed for gas optimization
        });
    }

    function getUserInsuranceStatus(address user) external view returns (
        bool hasActivePolicy,
        uint256 collateralizationRatio,
        uint256 coverage,
        uint256 premium,
        address paymentToken
    ) {
        (bool active, uint256 ratio, uint256 policyPremium, uint256 policyCoverage, , address token) = insuranceHook.getPolicyStatus(user);
        return (active, ratio, policyCoverage, policyPremium, token);
    }

    function getHookStatistics() external view returns (
        uint256 totalActivePolicies,
        uint256 riskTokenPrice
    ) {
        totalActivePolicies = insuranceHook.getTotalActivePolicies();
        riskTokenPrice = getRiskTokenPrice(); // Use cached version
        
        return (totalActivePolicies, riskTokenPrice);
    }

    function updateFeeRecipient(address newRecipient) external {
        require(msg.sender == feeRecipient, "Only current fee recipient can update");
        feeRecipient = newRecipient;
    }

    // Price functions with caching to reduce gas
    function getRiskTokenPrice() public view returns (uint256) {
        if (block.timestamp <= _priceLastUpdated + PRICE_CACHE_DURATION) {
            return _cachedRiskTokenPrice;
        }
        // Fallback to direct call if cache expired
        try riskToken.getTokenPrice() returns (uint256 price) {
            return price;
        } catch {
            return _cachedRiskTokenPrice; // Return cached value if call fails
        }
    }

    function getRiskTokenPriceFromPool() external view returns (uint256 price) {
        // Get pool for RISK/USDC pair
        address pool = stateView.getPool(address(riskToken), address(usdcToken), 3000);
        if (pool == address(0)) return getRiskTokenPrice(); // Fallback to cached price
        
        (uint160 sqrtPriceX96, , ) = stateView.getPoolState(pool);
        
        // Convert sqrtPriceX96 to actual price
        uint256 priceX96 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        price = (priceX96 * 1e18) >> (96 * 2);
        
        return price;
    }

    function _updateRiskTokenPrice() internal {
        try riskToken.getTokenPrice() returns (uint256 price) {
            _cachedRiskTokenPrice = price;
            _priceLastUpdated = block.timestamp;
            emit RiskTokenPriceUpdated(_cachedRiskTokenPrice);
        } catch {
            // Keep old price if call fails
        }
    }

    function updateRiskTokenPrice() external {
        _updateRiskTokenPrice();
    }

    // Emergency functions
    function emergencyWithdrawETH() external {
        require(msg.sender == feeRecipient, "Only fee recipient");
        payable(feeRecipient).transfer(address(this).balance);
    }

    function emergencyWithdrawToken(address token) external {
        require(msg.sender == feeRecipient, "Only fee recipient");
        IERC20(token).transfer(feeRecipient, IERC20(token).balanceOf(address(this)));
    }
}