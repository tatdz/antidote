// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMarginCallInsuranceHook {
    function getPolicyStatus(address user) external view returns (
        bool active,
        uint256 collateralizationRatio,
        uint256 premium,
        uint256 coverage,
        uint256 lastCheck,
        address paymentToken
    );
    
    // Add the missing function that's actually in the hook contract
    function getContractBalance() external view returns (uint256);
    function getUSDCBalance() external view returns (uint256);
}

contract RiskToken is ERC20, ERC20Permit, ReentrancyGuard {
    address public immutable insuranceHook;
    bool public tradingEnabled;
    
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**18;
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10**18;
    
    struct UserPosition {
        uint256 totalCoverage;
        uint256 totalPremiums;
        uint256 activePolicies;
        uint256 tokenBalance;
        uint256 lastUpdate;
        uint256 lastMintTimestamp;
    }
    
    mapping(address => UserPosition) public userPositions;
    
    uint256 public totalCoverageProvided;
    uint256 public totalPremiumsCollected;
    uint256 public totalClaimsPaid;
    uint256 public totalActivePolicies;
    
    uint256 public constant MINT_COOLDOWN = 1 days;
    
    event RiskTokenMinted(address indexed to, uint256 amount, uint256 coverageValue, uint256 premiumPaid);
    event RiskTokenBurned(address indexed from, uint256 amount, uint256 payoutValue);
    event InsurancePolicyLinked(address indexed user, uint256 coverageAmount, uint256 premiumPaid);
    event TradingEnabled();
    event TradingDisabled();

    constructor(
        string memory name,
        string memory symbol,
        address admin,
        address _insuranceHook
    ) ERC20(name, symbol) ERC20Permit(name) {
        require(_insuranceHook != address(0), "Invalid insurance hook address");
        insuranceHook = _insuranceHook;
        
        // Mint initial supply to admin
        _mint(admin, INITIAL_SUPPLY);
        
        // Enable trading by default
        tradingEnabled = true;
        
        emit TradingEnabled();
    }

    function mintTokensForInsurance(
        address user,
        uint256 coverageAmount,
        uint256 premiumPaid
    ) external nonReentrant returns (uint256 tokensToMint) {
        require(totalSupply() + coverageAmount <= MAX_SUPPLY, "Max supply exceeded");
        require(coverageAmount > 0, "Invalid coverage amount");
        require(premiumPaid > 0, "Invalid premium amount");
        
        // Check if user has active insurance policy
        (bool active, , , uint256 coverage, , ) = IMarginCallInsuranceHook(insuranceHook).getPolicyStatus(user);
        require(active, "No active insurance policy");
        require(coverage >= coverageAmount, "Coverage amount exceeds policy limit");
        
        // Check cooldown period
        UserPosition storage position = userPositions[user];
        require(
            block.timestamp >= position.lastMintTimestamp + MINT_COOLDOWN,
            "Minting cooldown active"
        );
        
        tokensToMint = calculateTokensForCoverage(coverageAmount, premiumPaid);
        require(tokensToMint > 0, "Token calculation failed");
        
        _mint(user, tokensToMint);
        
        // Update user position
        position.totalCoverage += coverageAmount;
        position.totalPremiums += premiumPaid;
        position.activePolicies++;
        position.tokenBalance += tokensToMint;
        position.lastUpdate = block.timestamp;
        position.lastMintTimestamp = block.timestamp;
        
        // Update global metrics
        totalCoverageProvided += coverageAmount;
        totalPremiumsCollected += premiumPaid;
        totalActivePolicies++;
        
        emit RiskTokenMinted(user, tokensToMint, coverageAmount, premiumPaid);
        emit InsurancePolicyLinked(user, coverageAmount, premiumPaid);
        
        return tokensToMint;
    }

    function burnTokensForClaim(
        address user,
        uint256 tokenAmount,
        uint256 claimAmount
    ) external nonReentrant {
        require(balanceOf(user) >= tokenAmount, "Insufficient tokens");
        require(tokenAmount > 0, "Invalid token amount");
        require(claimAmount > 0, "Invalid claim amount");
        
        // Verify policy is no longer active (claim was processed)
        (bool active, , , , , ) = IMarginCallInsuranceHook(insuranceHook).getPolicyStatus(user);
        require(!active, "Policy still active - cannot burn tokens");
        
        _burn(user, tokenAmount);
        
        // Update user position
        UserPosition storage position = userPositions[user];
        if (position.totalCoverage > claimAmount) {
            position.totalCoverage -= claimAmount;
        } else {
            position.totalCoverage = 0;
        }
        
        if (position.activePolicies > 0) {
            position.activePolicies--;
        }
        
        if (position.tokenBalance > tokenAmount) {
            position.tokenBalance -= tokenAmount;
        } else {
            position.tokenBalance = 0;
        }
        
        position.lastUpdate = block.timestamp;
        
        // Update global metrics
        totalClaimsPaid += claimAmount;
        if (totalActivePolicies > 0) {
            totalActivePolicies--;
        }
        
        emit RiskTokenBurned(user, tokenAmount, claimAmount);
    }

    function calculateTokensForCoverage(
        uint256 coverageAmount,
        uint256 premiumPaid
    ) public view returns (uint256) {
        if (coverageAmount == 0) return 0;
        
        uint256 baseTokens = coverageAmount;
        
        // Calculate risk factor based on claims history
        uint256 claimsRatio = totalCoverageProvided > 0 ? 
            (totalClaimsPaid * 1e18) / totalCoverageProvided : 0;
        
        // Higher claims ratio = lower token minting (more risk)
        uint256 riskFactor = 1e18 - (claimsRatio / 2);
        
        // Premium factor - higher premiums get more tokens
        uint256 premiumFactor = 1e18 + ((premiumPaid * 1e18) / (coverageAmount * 10));
        
        // Utilization factor - higher utilization = more tokens
        uint256 utilization = totalSupply() > 0 ? 
            (totalCoverageProvided * 1e18) / totalSupply() : 1e18;
        uint256 utilizationFactor = 1e18 + (utilization / 10);

        uint256 calculatedTokens = (baseTokens * riskFactor * premiumFactor * utilizationFactor) / (1e18 * 1e18 * 1e18);
        
        // Ensure minimum token amount
        return calculatedTokens > 100 ? calculatedTokens : 100;
    }

    function _update(address from, address to, uint256 amount) internal override {
        // Allow minting and burning (from/to zero address)
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        
        // Check trading restrictions
        require(tradingEnabled, "Trading not enabled");
        
        super._update(from, to, amount);
        
        // Update user positions for both parties
        _updateUserPosition(from, to, amount);
    }

    function _updateUserPosition(address from, address to, uint256 amount) internal {
        if (from != address(0)) {
            UserPosition storage fromPosition = userPositions[from];
            if (fromPosition.tokenBalance >= amount) {
                fromPosition.tokenBalance -= amount;
            } else {
                fromPosition.tokenBalance = 0;
            }
            fromPosition.lastUpdate = block.timestamp;
        }
        
        if (to != address(0)) {
            UserPosition storage toPosition = userPositions[to];
            toPosition.tokenBalance += amount;
            toPosition.lastUpdate = block.timestamp;
        }
    }

    function getRiskMetrics() external view returns (
        uint256 totalCoverage,
        uint256 totalPremiums,
        uint256 totalClaims,
        uint256 activePolicies,
        uint256 claimsRatio,
        uint256 utilizationRate
    ) {
        totalCoverage = totalCoverageProvided;
        totalPremiums = totalPremiumsCollected;
        totalClaims = totalClaimsPaid;
        activePolicies = totalActivePolicies;
        
        claimsRatio = totalCoverageProvided > 0 ? 
            (totalClaimsPaid * 10000) / totalCoverageProvided : 0;
            
        utilizationRate = totalSupply() > 0 ? 
            (totalCoverageProvided * 10000) / totalSupply() : 0;
            
        return (totalCoverage, totalPremiums, totalClaims, activePolicies, claimsRatio, utilizationRate);
    }

    function getTokenPrice() external view returns (uint256) {
        uint256 basePrice = 1 * 10**18; // 1 token = 1 base unit
        
        // Claims ratio impact (higher claims = lower price)
        uint256 claimsRatio = totalCoverageProvided > 0 ? 
            (totalClaimsPaid * 1e18) / totalCoverageProvided : 0;
        uint256 riskAdjustment = 1e18 - (claimsRatio / 2);
        
        // Utilization impact (higher utilization = higher price)
        uint256 utilization = totalSupply() > 0 ? 
            (totalCoverageProvided * 1e18) / totalSupply() : 0;
        uint256 utilizationBonus = utilization > 8e17 ? 
            ((utilization - 8e17) * 1e18) / 2e17 : 0; // 0.8 utilization = base, above = bonus

        // Premium collection impact
        uint256 premiumRatio = totalCoverageProvided > 0 ? 
            (totalPremiumsCollected * 1e18) / totalCoverageProvided : 1e18;
        uint256 premiumBonus = (premiumRatio * 1e18) / 2e18; // 50% of premium ratio as bonus

        uint256 calculatedPrice = (basePrice * riskAdjustment * (1e18 + utilizationBonus + premiumBonus)) / (1e18 * 1e18 * 1e18);
        
        // Ensure minimum price
        return calculatedPrice > 1e16 ? calculatedPrice : 1e16; // Minimum 0.01 base units
    }

    // Enable/disable trading functions
    function enableTrading() external {
        tradingEnabled = true;
        emit TradingEnabled();
    }

    function disableTrading() external {
        tradingEnabled = false;
        emit TradingDisabled();
    }

    // View functions
    function getUserPosition(address user) external view returns (
        uint256 totalCoverage,
        uint256 totalPremiums,
        uint256 activePolicies,
        uint256 tokenBalance,
        uint256 lastUpdate,
        uint256 nextMintTime
    ) {
        UserPosition memory position = userPositions[user];
        uint256 nextMint = position.lastMintTimestamp + MINT_COOLDOWN;
        
        return (
            position.totalCoverage,
            position.totalPremiums,
            position.activePolicies,
            position.tokenBalance,
            position.lastUpdate,
            nextMint
        );
    }

    function getHookStats() external view returns (
        uint256 hookBalance,
        uint256 hookUSDCBalance
    ) {
        hookBalance = IMarginCallInsuranceHook(insuranceHook).getContractBalance();
        hookUSDCBalance = IMarginCallInsuranceHook(insuranceHook).getUSDCBalance();
        
        return (hookBalance, hookUSDCBalance);
    }
}