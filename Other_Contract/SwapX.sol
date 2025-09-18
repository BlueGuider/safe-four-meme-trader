// SPDX-License-Identifier: MIT

pragma solidity = 0.8.28;

import "./Storage.sol";
import "./contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./contracts-upgradeable/interfaces/IERC1271Upgradeable.sol";
import "./contracts-upgradeable/proxy/utils/Initializable.sol";
import "./contracts-upgradeable/security/PausableUpgradeable.sol";
import "./contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import {FlapshLib} from "./extLib/FlapshLib.sol";
import {FourMemeLib} from "./extLib/FourMemeLib.sol";

import {UniV2Lib} from "./extLib/UniV2Lib.sol";
import {UniV3Lib} from "./extLib/UniV3Lib.sol";
import {UniV4Lib} from "./extLib/UniV4Lib.sol";

import {Common} from "./extLib/common.sol";
import "./interfaces/IFlapTokenManager.sol";
import "./interfaces/IFourTokenManager.sol";
import "./interfaces/IPancakeV3SwapCallback.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/IUniswapV3SwapCallback.sol";
import "./interfaces/IWETH.sol";
import "./libs/CallbackValidation.sol";
import "./libs/Path.sol";
import "./libs/SafeCast.sol";
import "./libs/SafeMath.sol";
import "./libs/TickMath.sol";
import "./libs/UniswapV2Library.sol";

contract SwapX is
    Storage,
    IUniswapV3SwapCallback,
    IPancakeV3SwapCallback,
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMath for uint256;
    using Path for bytes;
    using SafeCast for uint256;

    struct ExactInputSingleParams {
        address factoryAddress;
        address poolAddress;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        address[] factoryAddresses;
        address[] poolAddresses;
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    struct ExactOutputSingleParams {
        address factoryAddress;
        address poolAddress;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactOutputParams {
        address[] factoryAddresses;
        address[] poolAddresses;
        bytes path;
        address tokenIn;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    struct ExactInputMixedParams {
        string[] routes;
        bytes path1;
        address factory1;
        address poolAddress1;
        bytes path2;
        address factory2;
        address poolAddress2;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    struct ExactOutputMixedParams {
        string[] routes;
        bytes path1;
        address factory1;
        bytes path2;
        address factory2;
        uint256 amountIn2; // only for v2-v3 router
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    struct SwapCallbackData {
        bytes path;
        address payer;
        address payerOrigin;
    }

    event Swap(
        address indexed payer,
        address indexed receiver,
        address indexed feeToken,
        uint256 amountIn,
        uint256 amountOut,
        Common.SwapDesc[] descs
    );

    event FeeCollected(address indexed token, address indexed payer, uint256 amount, uint256 timestamp);

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "Transaction too old");
        _;
    }

    receive() external payable {}

    function initialize(
        address _factoryV3,
        address _pancakeFactoryV3,
        address _WETH,
        address _feeCollector,
        uint256 _feeRate
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        factoryV3 = _factoryV3;
        pancakeFactoryV3 = _pancakeFactoryV3;
        feeCollector = _feeCollector;
        feeRate = _feeRate;
        feeDenominator = 10000;
        WETH = _WETH;
        amountInCached = type(uint256).max;
    }

    // take fee
    function takeFee(address tokenIn, uint256 amountIn) internal returns (uint256) {
        if (feeExcludeList[msg.sender]) {
            return 0;
        }

        uint256 fee = amountIn.mul(feeRate).div(feeDenominator);

        if (tokenIn == address(0) || tokenIn == WETH) {
            require(address(this).balance > fee, "insufficient funds");
            (bool success,) = address(feeCollector).call{value: fee}("");
            require(success, "SwapX: take fee error");
            emit FeeCollected(address(0), msg.sender, fee, block.timestamp);
        } else {
            IERC20Upgradeable(tokenIn).safeTransferFrom(msg.sender, feeCollector, fee);
            emit FeeCollected(tokenIn, msg.sender, fee, block.timestamp);
        }

        return fee;
    }

    function takeFeeTo(address tokenIn, uint256 amountIn) internal returns (uint256) {
        uint256 fee = amountIn.mul(feeRate).div(feeDenominator);
        if (fee > 0) {
            Common.pay(tokenIn, address(this), feeCollector, fee);
            emit FeeCollected(tokenIn, msg.sender, fee, block.timestamp);
        }
        return fee;
    }

    function sellMemeToken2(FourMemeLib.SellFourMeme memory data) external nonReentrant whenNotPaused {
        // rounding down to 1e9
        data.amountIn = data.amountIn / 1e9 * 1e9;
        uint256 amount = FourMemeLib.sellMemeToken2(data);
        uint256 fee = takeFee(address(0), amount);
        require(amount - fee >= data.amountOutMinimum, "min return not reached");
        (bool success,) = address(msg.sender).call{value: amount - fee}("");
        require(success, "refund bnb error");
    }

    function buyMemeToken2(FourMemeLib.BuyFourMeme memory data) external payable nonReentrant whenNotPaused {
        require(msg.value >= data.amountIn, "invalid funds");
        uint256 fee = takeFee(address(0), data.amountIn);
        data.amountIn -= fee;
        FourMemeLib.buyMemeToken2(data);
    }

    // buy meme function, exact bnb amount
    function buyMemeToken(address tokenManager, address token, address recipient, uint256 funds, uint256 minAmount)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        require(msg.value >= funds, "invalid funds");
        uint256 fee = takeFee(address(0), funds);
        FourMemeLib.buyMemeToken(tokenManager, token, recipient, funds - fee, minAmount);
    }
    // sell meme function, exact bnb amount

    function sellMemeToken(FourMemeLib.SellFourMemeSingle memory data) external nonReentrant whenNotPaused {
        data.feeRate = feeRate;
        data.feeRecipient = feeCollector;
        data.payerOrigin = msg.sender;
        // rounding down to 1e9
        data.amountIn = data.amountIn / 1e9 * 1e9;
        FourMemeLib.sellMemeTokenSingle(data);
    }

    // buy meme function, exact bnb amount
    function buyFlapToken(address manager, address token, address recipient, uint256 minAmount)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        uint256 funds = msg.value;
        uint256 fee = takeFee(address(0), funds);
        FlapshLib.BuyFlapshParams memory buyParams;
        buyParams.manager = manager;
        buyParams.token = token;
        buyParams.recipient = recipient;
        buyParams.funds = funds - fee;
        buyParams.minAmount = minAmount;

        FlapshLib.buyFlapsh(buyParams);
    }

    function sellFlapToken(address manager, address token, address recipient, uint256 amount, uint256 minAmount)
        external
        nonReentrant
        whenNotPaused
    {
        uint256 balanceBefore = address(this).balance;

        FlapshLib.SellFlapshParams memory sellParams;
        sellParams.manager = manager;
        sellParams.token = token;
        sellParams.recipient = recipient;
        sellParams.funds = amount;
        sellParams.minAmount = minAmount;

        FlapshLib.sellFlapsh(sellParams);
        uint256 balanceAfter = address(this).balance;
        uint256 realAmountOut = balanceAfter - balanceBefore;
        uint256 fee = takeFee(address(0), realAmountOut);
        (bool success,) = address(msg.sender).call{value: realAmountOut - fee}("");
        require(success, "refund bnb error");
    }

    function swap(Common.SwapDesc[] memory descs, address feeToken, uint256 amountIn, uint256 minReturn)
        public
        payable
        nonReentrant
        whenNotPaused
    {
        require(descs.length > 0, "ERR_INVALID_ARGUMENT: descs is empty");
        require(
            feeToken == descs[0].tokenIn || feeToken == descs[descs.length - 1].tokenOut,
            "ERR_INVALID_ARGUMENT: fee token is not the same as token in or out"
        );
        address payer = msg.sender;
        address receiver = msg.sender;

        address payerOrigin = msg.sender;
        uint256 amountOut = 0;
        uint256 balanceBefore = Common.getBalance(descs[descs.length - 1].tokenOut, msg.sender);
        // fromToken is feeToken
        if (feeToken == descs[0].tokenIn) {
            uint256 fee = takeFee(feeToken, amountIn);
            amountIn -= fee;
        } else {
            receiver = address(this);
        }
        for (uint256 i = 0; i < descs.length; i++) {
            Common.SwapDesc memory desc = descs[i];

            address middleReceiver = Common.getMiddleReceiver(descs, i, receiver);
            if (desc.swapType == Common.SwapType.V2_EXACT_IN) {
                amountOut = UniV2Lib.swap(payer, middleReceiver, payerOrigin, amountIn, desc);
            } else if (desc.swapType == Common.SwapType.V3_EXACT_IN) {
                amountOut = UniV3Lib.swap(payer, middleReceiver, payerOrigin, amountIn, desc);
            } else if (desc.swapType == Common.SwapType.V4_EXACT_IN) {
                amountOut = UniV4Lib.swap(payer, middleReceiver, payerOrigin, amountIn, desc);
            } else {
                revert("SwapX: invalid swap type");
            }
            // update amountIn for next swap
            if (i != descs.length - 1) {
                payer = address(this);
                amountIn = amountOut;
            }
        }
        if (feeToken == descs[descs.length - 1].tokenOut) {
            uint256 fee = takeFeeTo(feeToken, amountOut);
            amountOut -= fee;
            Common.pay(feeToken, address(this), msg.sender, amountOut);
        }
        uint256 balanceAfter = Common.getBalance(descs[descs.length - 1].tokenOut, msg.sender);
        require(balanceAfter - balanceBefore >= minReturn, "ERR_EXCEEDED_SLIPPAGE:minReturn not reached");
        emit Swap(msg.sender, msg.sender, feeToken, amountIn, amountOut, descs);
    }

    function unlockCallback(bytes memory data) external returns (bytes memory) {
        return UniV4Lib.unlockCallback(data);
    }
    // V2: Any swap, ExactIn single-hop - SupportingFeeOnTransferTokens

    function swapV2ExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address poolAddress
    ) public payable nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(poolAddress != address(0), "SwapX: invalid pool address");
        require(amountIn > 0, "SwapX: amout in is zero");

        bool nativeIn = false;
        if (tokenIn == address(0)) {
            require(msg.value >= amountIn, "SwapX: amount in and value mismatch");
            nativeIn = true;
            tokenIn = WETH;
            // refund
            uint256 amount = msg.value - amountIn;
            if (amount > 0) {
                (bool success,) = address(msg.sender).call{value: amount}("");
                require(success, "SwapX: refund ETH error");
            }
            uint256 fee = takeFee(address(0), amountIn);
            amountIn = amountIn - fee;
        }

        if (nativeIn) {
            pay(tokenIn, address(this), poolAddress, amountIn);
        } else {
            pay(tokenIn, msg.sender, poolAddress, amountIn);
        }

        bool nativeOut = false;
        if (tokenOut == address(0)) {
            nativeOut = true;
        }

        uint256 balanceBefore = nativeOut
            ? IERC20Upgradeable(WETH).balanceOf(address(this))
            : IERC20Upgradeable(tokenOut).balanceOf(msg.sender);

        IUniswapV2Pair pair = IUniswapV2Pair(poolAddress);
        address token0 = pair.token0();
        uint256 amountInput;
        uint256 amountOutput;
        {
            // scope to avoid stack too deep errors
            (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
            (uint256 reserveInput, uint256 reserveOutput) =
                tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
            amountInput = IERC20Upgradeable(tokenIn).balanceOf(address(pair)).sub(reserveInput);
            amountOutput = UniswapV2Library.getAmountOut(amountInput, reserveInput, reserveOutput);
        }
        (uint256 amount0Out, uint256 amount1Out) =
            tokenIn == token0 ? (uint256(0), amountOutput) : (amountOutput, uint256(0));
        address to = nativeOut ? address(this) : msg.sender;
        pair.swap(amount0Out, amount1Out, to, new bytes(0));

        if (nativeOut) {
            amountOut = IERC20Upgradeable(WETH).balanceOf(address(this)).sub(balanceBefore);
            IWETH(WETH).withdraw(amountOut);
            uint256 fee = takeFee(address(0), amountOut);
            (bool success,) = address(msg.sender).call{value: amountOut - fee}("");
            require(success, "SwapX: send ETH out error");
        } else {
            amountOut = IERC20Upgradeable(tokenOut).balanceOf(msg.sender).sub(balanceBefore);
        }
        require(amountOut >= amountOutMin, "SwapX: insufficient output amount");
    }

    // V2: Any swap, ExactOut single-hop - * not support fee-on-transfer tokens *
    // function swapV2ExactOut(
    //     address tokenIn,
    //     address tokenOut,
    //     uint256 amountInMax,
    //     uint256 amountOut,
    //     address poolAddress
    //  ) payable public nonReentrant whenNotPaused returns (uint amountIn){

    //     require(poolAddress != address(0), "SwapX: invalid pool address");
    //     require(amountInMax > 0, "SwapX: amout in max is zero");

    //     bool nativeIn = false;
    //     if (tokenIn == address(0)) {
    //         tokenIn = WETH;
    //         nativeIn = true;
    //         require(msg.value >= amountInMax, "SwapX: amount in and value mismatch");
    //     }

    //     bool nativeOut = false;
    //     if (tokenOut == address(0))
    //         nativeOut = true;

    //     IUniswapV2Pair pair = IUniswapV2Pair(poolAddress);
    //     address token0 = pair.token0();
    //     { // scope to avoid stack too deep errors
    //         (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
    //         (uint256 reserveInput, uint256 reserveOutput) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    //         amountIn = UniswapV2Library.getAmountIn(amountOut, reserveInput, reserveOutput);
    //         require(amountIn <= amountInMax, "SwapX: eswapV2ExactOutxcessive input amount");

    //         uint256 fee = 0;
    //         if (!nativeOut) {
    //             fee = takeFee(tokenIn, amountIn);
    //             amountIn = amountIn - fee;
    //         }

    //         if(nativeIn) {
    //             pay(tokenIn, address(this), poolAddress, amountIn);
    //             uint256 amount = msg.value - amountIn - fee;
    //             // refund
    //             if (amount > 0) {
    //                 (bool success, ) = address(msg.sender).call{value: amount}("");
    //                 require(success, "SwapX: refund ETH error");
    //             }
    //         } else {
    //             pay(tokenIn, msg.sender, poolAddress, amountIn);
    //         }
    //     }
    //     (uint256 amount0Out, uint256 amount1Out) = tokenIn == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
    //     address to = nativeOut ? address(this) : msg.sender;
    //     pair.swap(amount0Out, amount1Out, to, new bytes(0));

    //     if (nativeOut) {
    //         IWETH(WETH).withdraw(amountOut);
    //         uint256 fee = takeFee(address(0), amountOut);
    //         (bool success, ) = address(msg.sender).call{value: amountOut-fee}("");
    //         require(success, "SwapX: send ETH out error");
    //     }
    // }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint256[] memory amounts, address[] memory path, address _to, address _factory) internal virtual {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = UniswapV2Library.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) =
                input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? UniswapV2Library.pairFor(_factory, output, path[i + 2]) : _to;
            IUniswapV2Pair(UniswapV2Library.pairFor(_factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(address[] memory path, address _to, address _factory)
        internal
        virtual
    {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = UniswapV2Library.sortTokens(input, output);
            IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(_factory, input, output));
            uint256 amountInput;
            uint256 amountOutput;
            {
                // scope to avoid stack too deep errors
                (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
                (uint256 reserveInput, uint256 reserveOutput) =
                    input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
                amountInput = IERC20Upgradeable(input).balanceOf(address(pair)).sub(reserveInput);
                amountOutput = UniswapV2Library.getAmountOut(amountInput, reserveInput, reserveOutput);
            }
            (uint256 amount0Out, uint256 amount1Out) =
                input == token0 ? (uint256(0), amountOutput) : (amountOutput, uint256(0));
            address to = i < path.length - 2 ? UniswapV2Library.pairFor(_factory, output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    // V2-V2: Uniswap/Sushiswap, SupportingFeeOnTransferTokens and multi-hop
    function swapV2MultiHopExactIn(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address recipient,
        uint256 deadline,
        address factory
    ) public payable nonReentrant whenNotPaused checkDeadline(deadline) returns (uint256[] memory amounts) {
        require(amountIn > 0, "SwapX: amout in is zero");

        bool nativeIn = false;
        if (tokenIn == address(0)) {
            require(msg.value >= amountIn, "SwapX: amount in and value mismatch");
            nativeIn = true;
            tokenIn = WETH;
            // refund
            uint256 amount = msg.value - amountIn;
            if (amount > 0) {
                (bool success,) = address(msg.sender).call{value: amount}("");
                require(success, "SwapX: refund ETH error");
            }
        }

        bool nativeOut = false;
        address tokenOut = path[path.length - 1];
        if (tokenOut == WETH) {
            nativeOut = true;
        }

        if (!nativeOut) {
            uint256 fee = takeFee(tokenIn, amountIn);
            amountIn = amountIn - fee;
        }

        address firstPool = UniswapV2Library.pairFor(factory, path[0], path[1]);
        if (nativeIn) {
            pay(tokenIn, address(this), firstPool, amountIn);
        } else {
            pay(tokenIn, msg.sender, firstPool, amountIn);
        }
        require(tokenIn == path[0], "invalid path");

        amounts = UniswapV2Library.getAmountsOut(factory, amountIn, path);

        uint256 balanceBefore = IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : recipient);
        _swapSupportingFeeOnTransferTokens(path, nativeOut ? address(this) : recipient, factory);
        uint256 amountOut =
            IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : recipient).sub(balanceBefore);
        amounts[path.length - 1] = amountOut;
        require(amountOut >= amountOutMin, "SwapX: insufficient output amount");

        if (nativeOut) {
            IWETH(WETH).withdraw(amountOut);
            uint256 fee = takeFee(address(0), amountOut);
            (bool success,) = address(recipient).call{value: amountOut - fee}("");
            require(success, "SwapX: send ETH out error");
        }
    }

    // // V2-V2: Uniswap, ExactOut multi-hop, not support fee-on-transfer token in output
    // function swapV2MultiHopExactOut(
    //     address tokenIn,
    //     uint256 amountInMax,
    //     uint256 amountOut,
    //     address[] calldata path,
    //     address recipient,
    //     uint deadline,
    //     address factory
    // ) payable public nonReentrant whenNotPaused checkDeadline(deadline) returns (uint[] memory amounts){

    //     require(amountInMax > 0, "SwapX: amount in max is zero");

    //     bool nativeIn = false;
    //     if (tokenIn == address(0)) {
    //         nativeIn = true;
    //         tokenIn = WETH;
    //         require(msg.value >= amountInMax, "SwapX: amount in and value mismatch");
    //     }

    //     bool nativeOut = false;
    //     address tokenOut = path[path.length-1];
    //     if (tokenOut == WETH)
    //         nativeOut = true;

    //     amounts = UniswapV2Library.getAmountsIn(factory, amountOut, path);

    //     uint256 fee = 0;
    //     if (!nativeOut) {
    //         fee = takeFee(tokenIn, amounts[0]);
    //         amounts[0] = amounts[0] - fee;
    //         require(amounts[0] + fee <= amountInMax, 'SwapX: excessive input amount');
    //     }

    //     address firstPool = UniswapV2Library.pairFor(factory, path[0], path[1]);
    //     if (nativeIn) {
    //         pay(tokenIn, address(this), firstPool, amounts[0]);
    //         uint amount = msg.value - amounts[0] - fee;
    //         // refund
    //         if (amount > 0) {
    //             (bool success, ) = address(msg.sender).call{value: amount}("");
    //             require(success, "SwapX: refund ETH error");
    //         }
    //     } else
    //         pay(tokenIn, msg.sender, firstPool, amounts[0]);

    //     _swap(amounts, path, nativeOut ? address(this) : recipient, factory);

    //     if (nativeOut) {
    //         IWETH(WETH).withdraw(amountOut);
    //         fee = takeFee(address(0), amountOut);
    //         (bool success, ) = address(recipient).call{value: amountOut-fee}("");
    //         require(success, "SwapX: send ETH out error");
    //     }
    // }

    /// UniswapV3SwapCallback
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();
        CallbackValidation.verifyCallback(factoryV3, tokenIn, tokenOut, fee);

        (bool isExactInput, uint256 amountToPay) =
            amount0Delta > 0 ? (tokenIn < tokenOut, uint256(amount0Delta)) : (tokenOut < tokenIn, uint256(amount1Delta));
        if (isExactInput) {
            pay(tokenIn, data.payer, msg.sender, amountToPay);

            uint256 amount =
                tokenIn == WETH ? address(this).balance : IERC20Upgradeable(tokenIn).balanceOf(address(this));
            if (amount > 0) {
                pay(tokenIn, address(this), data.payerOrigin, amount);
            }
        }
        // } else {
        //     // either initiate the next swap or pay
        //     if (data.path.hasMultiplePools()) {
        //         data.path = data.path.skipToken();
        //         exactOutputInternal(amountToPay, msg.sender, 0, data);
        //     } else {
        //         amountInCached = amountToPay;
        //         tokenIn = tokenOut; // swap in/out because exact output swaps are reversed
        //         pay(tokenIn, data.payer, msg.sender, amountToPay);
        //     }
        // }
    }
    /// PancakeV3SwapCallback

    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();
        CallbackValidation.verifyCallback(pancakeFactoryV3, tokenIn, tokenOut, fee);

        (bool isExactInput, uint256 amountToPay) =
            amount0Delta > 0 ? (tokenIn < tokenOut, uint256(amount0Delta)) : (tokenOut < tokenIn, uint256(amount1Delta));
        if (isExactInput) {
            pay(tokenIn, data.payer, msg.sender, amountToPay);

            uint256 amount =
                tokenIn == WETH ? address(this).balance : IERC20Upgradeable(tokenIn).balanceOf(address(this));
            if (amount > 0) {
                pay(tokenIn, address(this), data.payerOrigin, amount);
            }
        }
        // } else {
        //     // either initiate the next swap or pay
        //     if (data.path.hasMultiplePools()) {
        //         data.path = data.path.skipToken();
        //         exactOutputInternal(amountToPay, msg.sender, 0, data);
        //     } else {
        //         amountInCached = amountToPay;
        //         tokenIn = tokenOut; // swap in/out because exact output swaps are reversed
        //         pay(tokenIn, data.payer, msg.sender, amountToPay);
        //     }
        // }
    }

    // V3: ExactIn single-hop
    function swapV3ExactIn(ExactInputSingleParams memory params)
        external
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        require(params.amountIn > 0, "SwapX: amount in is zero");

        if (params.tokenIn == WETH || params.tokenIn == address(0)) {
            params.tokenIn = WETH;
            require(msg.value >= params.amountIn, "SwapX: amount in and value mismatch");
            // refund
            uint256 amount = msg.value - params.amountIn;
            if (amount > 0) {
                (bool success,) = address(msg.sender).call{value: amount}("");
                require(success, "SwapX: refund ETH error");
            }
        }

        bool nativeOut = false;
        if (params.tokenOut == WETH) {
            nativeOut = true;
        }

        if (!nativeOut) {
            uint256 fee = takeFee(params.tokenIn, params.amountIn);
            params.amountIn = params.amountIn - fee;
        }

        factoryV3 = params.factoryAddress;
        amountOut = exactInputInternal(
            params.poolAddress,
            params.amountIn,
            nativeOut ? address(0) : params.recipient,
            params.sqrtPriceLimitX96,
            SwapCallbackData({
                path: abi.encodePacked(params.tokenIn, params.fee, params.tokenOut),
                payer: msg.sender,
                payerOrigin: msg.sender
            })
        );

        require(amountOut >= params.amountOutMinimum, "SwapX: insufficient out amount");

        if (nativeOut) {
            IWETH(WETH).withdraw(amountOut);
            uint256 fee = takeFee(address(0), amountOut);
            (bool success,) = address(params.recipient).call{value: amountOut - fee}("");
            require(success, "SwapX: send ETH out error");
        }
    }

    // // V3: ExactOut single-hop
    // function swapV3ExactOut (
    //     ExactOutputSingleParams memory params
    // ) payable public nonReentrant whenNotPaused checkDeadline(params.deadline) returns (uint256 amountIn) {

    //     require(params.amountInMaximum > 0, "SwapX: amount in max is zero");

    //     bool nativeIn = false;
    //     if (params.tokenIn == WETH || params.tokenIn == address(0)) {
    //         params.tokenIn = WETH;
    //         nativeIn = true;
    //         require(msg.value >= params.amountInMaximum, "SwapX: amount in max and value mismatch");
    //     }

    //     bool nativeOut = false;
    //     if (params.tokenOut == WETH || params.tokenOut == address(0)) {
    //         params.tokenOut = WETH;
    //         nativeOut = true;
    //     }

    //     uint256 fee = 0;
    //     if (!nativeOut) {
    //         fee = takeFee(params.tokenIn, amountIn);
    //         amountIn = amountIn - fee;
    //         require(amountIn + fee <= params.amountInMaximum, "SwapX: too much requested");
    //     }

    //     amountIn = exactOutputInternal(
    //         params.amountOut,
    //         nativeOut ? address(0) : params.recipient,
    //         params.sqrtPriceLimitX96,
    //         SwapCallbackData({path: abi.encodePacked(params.tokenOut, params.fee, params.tokenIn), payer: msg.sender, payerOrigin: msg.sender})
    //     );

    //     if (nativeIn) {
    //         uint amount = msg.value - amountIn - fee;
    //         // refund
    //         if (amount > 0) {
    //             (bool success, ) = address(msg.sender).call{value: amount}("");
    //             require(success, "SwapX: refund ETH error");
    //         }
    //     }

    //     if (nativeOut) {
    //         IWETH(WETH).withdraw(params.amountOut);
    //         fee = takeFee(address(0), params.amountOut);

    //         (bool success, ) = address(params.recipient).call{value: params.amountOut - fee}("");
    //         require(success, "SwapX: send ETH out error");
    //     }

    //     amountInCached = type(uint256).max;
    // }

    // V3-V3: ExactIn multi-hop
    function swapV3MultiHopExactIn(ExactInputParams memory params)
        public
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        require(params.amountIn > 0, "SwapX: amount in is zero");
        if (msg.value > 0) {
            require(msg.value >= params.amountIn, "SwapX: amount in and value mismatch");
            // refund
            uint256 amount = msg.value - params.amountIn;
            if (amount > 0) {
                (bool success,) = address(msg.sender).call{value: amount}("");
                require(success, "SwapX: refund ETH error");
            }
        }

        (address tokenIn,,) = params.path.decodeFirstPool();
        if (tokenIn == WETH || tokenIn == address(0)) {
            tokenIn = WETH;
            uint256 fee = takeFee(address(0), params.amountIn);
            params.amountIn = params.amountIn - fee;
        }

        address payer = msg.sender; // msg.sender pays for the first hop

        bool nativeOut = false;
        uint256 i = 0;
        while (true) {
            bool hasMultiplePools = params.path.hasMultiplePools();

            if (!hasMultiplePools) {
                (, address tokenOut,) = params.path.decodeFirstPool();
                if (tokenOut == WETH) {
                    nativeOut = true;
                }
            }
            // the outputs of prior swaps become the inputs to subsequent ones
            factoryV3 = params.factoryAddresses[i];
            params.amountIn = exactInputInternal(
                params.poolAddresses[i],
                params.amountIn,
                hasMultiplePools ? address(this) : (nativeOut ? address(this) : params.recipient),
                0,
                SwapCallbackData({path: params.path.getFirstPool(), payer: payer, payerOrigin: msg.sender})
            );

            // decide whether to continue or terminate
            if (hasMultiplePools) {
                payer = address(this); // at this point, the caller has paid
                params.path = params.path.skipToken();
                i++;
            } else {
                amountOut = params.amountIn;
                break;
            }
        }
        require(amountOut >= params.amountOutMinimum, "SwapX: too little received");

        if (nativeOut) {
            IWETH(WETH).withdraw(amountOut);
            uint256 fee = takeFee(address(0), amountOut);

            (bool success,) = address(params.recipient).call{value: amountOut - fee}("");
            require(success, "SwapX: send ETH out error");
        }
    }

    // V3-V3: ExactOut multi-hop
    // function swapV3MultiHopExactOut(
    //     ExactOutputParams memory params
    // ) external payable nonReentrant whenNotPaused checkDeadline(params.deadline) returns (uint256 amountIn) {

    //     require(params.amountInMaximum > 0, "SwapX: amount in max is zero");
    //     if (msg.value > 0)
    //         require(msg.value >= params.amountInMaximum, "SwapX: amount in max and value mismatch");

    //     bool nativeOut = false;
    //     (address tokenOut, , ) = params.path.decodeFirstPool();
    //     if (tokenOut == WETH)
    //         nativeOut = true;

    //     uint256 fee = 0;
    //     if (!nativeOut) {
    //         fee = takeFee(params.tokenIn, amountIn);
    //         amountIn = amountIn - fee;
    //         require(amountIn + fee <= params.amountInMaximum, 'SwapX: too much requested');
    //     }

    //     exactOutputInternal(
    //         params.amountOut,
    //         nativeOut ? address(this) : params.recipient,
    //         0,
    //         SwapCallbackData({path: params.path, payer: msg.sender, payerOrigin: msg.sender})
    //     );

    //     amountIn = amountInCached;

    //     if (params.tokenIn == WETH || params.tokenIn == address(0)) {
    //         if (msg.value > 0) {
    //             // refund
    //             uint256 amount = msg.value - amountIn - fee;
    //             if (amount > 0) {
    //                 (bool success, ) = address(msg.sender).call{value: amount}("");
    //                 require(success, "SwapX: refund ETH error");
    //             }
    //         }
    //     }

    //     if (nativeOut) {
    //         IWETH(WETH).withdraw(params.amountOut);
    //         fee = takeFee(address(0), params.amountOut);
    //         (bool success, ) = address(params.recipient).call{value: params.amountOut-fee}("");
    //         require(success, "SwapX: send ETH out error");
    //     }

    //     amountInCached = type(uint256).max;
    // }

    function isStrEqual(string memory str1, string memory str2) internal pure returns (bool) {
        return keccak256(bytes(str1)) == keccak256(bytes(str2));
    }

    // Mixed: ExactIn multi-hop, token not supporting zero address
    function swapMixedMultiHopExactIn(ExactInputMixedParams memory params)
        public
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        require(params.routes.length == 2, "SwapX: only 2 routes supported");

        require(params.amountIn > 0, "SwapX: amount in is zero");

        (address tokenIn, address tokenOut1, uint24 fee1) = params.path1.decodeFirstPool();
        bool nativeIn = false;
        if (tokenIn == WETH || tokenIn == address(0)) {
            require(msg.value >= params.amountIn, "SwapX: amount in and value mismatch");
            nativeIn = true;
            tokenIn = WETH;
            // refund
            uint256 amount = msg.value - params.amountIn;
            if (amount > 0) {
                (bool success,) = address(msg.sender).call{value: amount}("");
                require(success, "SwapX: refund ETH error");
            }
            uint256 fee = takeFee(address(0), params.amountIn);
            params.amountIn = params.amountIn - fee;
        }

        if (isStrEqual(params.routes[0], "v2") && isStrEqual(params.routes[1], "v2")) {
            // uni - sushi, or verse
            address poolAddress1 = UniswapV2Library.pairFor(params.factory1, tokenIn, tokenOut1);
            if (nativeIn) {
                pay(tokenIn, address(this), poolAddress1, params.amountIn);
            } else {
                pay(tokenIn, msg.sender, poolAddress1, params.amountIn);
            }

            address[] memory path1 = new address[](2);
            path1[0] = tokenIn;
            path1[1] = tokenOut1;

            (, address tokenOut,) = params.path2.decodeFirstPool();
            address[] memory path2 = new address[](2);
            path2[0] = tokenOut1;
            path2[1] = tokenOut;
            address poolAddress2 = UniswapV2Library.pairFor(params.factory2, tokenOut1, tokenOut);

            bool nativeOut = tokenOut == WETH;

            uint256 balanceBefore = IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : params.recipient);
            _swapSupportingFeeOnTransferTokens(path1, poolAddress2, params.factory1);
            _swapSupportingFeeOnTransferTokens(path2, nativeOut ? address(this) : params.recipient, params.factory2);
            amountOut =
                IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : params.recipient).sub(balanceBefore);
            if (nativeOut) {
                IWETH(WETH).withdraw(amountOut);
                uint256 fee = takeFee(address(0), amountOut);
                (bool success,) = address(params.recipient).call{value: amountOut - fee}("");
                require(success, "SwapX: send ETH out error");
            }
        } else if (isStrEqual(params.routes[0], "v2") && isStrEqual(params.routes[1], "v3")) {
            address poolAddress1 = UniswapV2Library.pairFor(params.factory1, tokenIn, tokenOut1);
            if (nativeIn) {
                pay(tokenIn, address(this), poolAddress1, params.amountIn);
            } else {
                pay(tokenIn, msg.sender, poolAddress1, params.amountIn);
            }

            address[] memory path1 = new address[](2);
            path1[0] = tokenIn;
            path1[1] = tokenOut1;

            (, address tokenOut,) = params.path2.decodeFirstPool();
            bool nativeOut = tokenOut == WETH;
            uint256 balanceBefore = IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : params.recipient);
            _swapSupportingFeeOnTransferTokens(path1, address(this), params.factory1);

            factoryV3 = params.factory2;
            amountOut = exactInputInternal(
                params.poolAddress2,
                IERC20Upgradeable(tokenOut1).balanceOf(address(this)),
                nativeOut ? address(this) : params.recipient,
                0,
                SwapCallbackData({path: params.path2, payer: address(this), payerOrigin: msg.sender})
            );
            amountOut =
                IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : params.recipient).sub(balanceBefore);
            if (nativeOut) {
                IWETH(WETH).withdraw(amountOut);
                uint256 fee = takeFee(address(0), amountOut);
                (bool success,) = address(params.recipient).call{value: amountOut - fee}("");
                require(success, "SwapX: send ETH out error");
            }
        } else if (isStrEqual(params.routes[0], "v3") && isStrEqual(params.routes[1], "v2")) {
            (address tokenIn2, address tokenOut,) = params.path2.decodeFirstPool();
            address pairV2Address = UniswapV2Library.pairFor(params.factory2, tokenIn2, tokenOut);

            factoryV3 = params.factory1;
            uint256 amountOut1 = exactInputInternal(
                params.poolAddress1,
                params.amountIn,
                pairV2Address,
                0,
                SwapCallbackData({
                    path: abi.encodePacked(tokenIn, fee1, tokenOut1),
                    payer: msg.sender,
                    payerOrigin: msg.sender
                })
            );

            address[] memory path2 = new address[](2);
            path2[0] = tokenIn2;
            path2[1] = tokenOut;
            uint256[] memory amounts2 = UniswapV2Library.getAmountsOut(params.factory2, amountOut1, path2);
            amountOut = amounts2[amounts2.length - 1];

            bool nativeOut = tokenOut == WETH;
            uint256 balanceBefore = IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : params.recipient);
            _swapSupportingFeeOnTransferTokens(path2, nativeOut ? address(this) : params.recipient, params.factory2);
            amountOut =
                IERC20Upgradeable(tokenOut).balanceOf(nativeOut ? address(this) : params.recipient).sub(balanceBefore);
            if (nativeOut) {
                IWETH(WETH).withdraw(amountOut);
                uint256 fee = takeFee(address(0), amountOut);
                (bool success,) = address(params.recipient).call{value: amountOut - fee}("");
                require(success, "SwapX: send ETH out error");
            }
        }

        require(amountOut >= params.amountOutMinimum, "SwapX: too little received");
    }

    // V3: compute pool address
    function getPool(address tokenA, address tokenB, uint24 fee) public view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(factoryV3, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    /// V3: Performs a single exact input swap
    function exactInputInternal(
        address poolAddress,
        uint256 amountIn,
        address recipient,
        uint160 sqrtPriceLimitX96,
        SwapCallbackData memory data
    ) private returns (uint256 amountOut) {
        // allow swapping to the router address with address 0
        if (recipient == address(0)) recipient = address(this);

        (address tokenIn, address tokenOut,) = data.path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = IUniswapV3Pool(poolAddress).swap(
            recipient,
            zeroForOne,
            amountIn.toInt256(),
            sqrtPriceLimitX96 == 0
                ? (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    /// Performs a single exact output swap
    // function exactOutputInternal(
    //     uint256 amountOut,
    //     address recipient,
    //     uint160 sqrtPriceLimitX96,
    //     SwapCallbackData memory data
    // ) private returns (uint256 amountIn) {
    //     // allow swapping to the router address with address 0
    //     if (recipient == address(0)) recipient = address(this);

    //     (address tokenOut, address tokenIn, uint24 fee) = data.path.decodeFirstPool();

    //     bool zeroForOne = tokenIn < tokenOut;

    //     (int256 amount0Delta, int256 amount1Delta) =
    //         getPool(tokenIn, tokenOut, fee).swap(
    //             recipient,
    //             zeroForOne,
    //             -amountOut.toInt256(),
    //             sqrtPriceLimitX96 == 0
    //                 ? (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
    //                 : sqrtPriceLimitX96,
    //             abi.encode(data)
    //         );

    //     uint256 amountOutReceived;
    //     (amountIn, amountOutReceived) = zeroForOne
    //         ? (uint256(amount0Delta), uint256(-amount1Delta))
    //         : (uint256(amount1Delta), uint256(-amount0Delta));
    //     // it's technically possible to not receive the full output amount,
    //     // so if no price limit has been specified, require this possibility away
    //     if (sqrtPriceLimitX96 == 0) require(amountOutReceived == amountOut);
    // }

    function pay(address token, address payer, address recipient, uint256 value) internal {
        if (token == WETH && address(this).balance >= value) {
            // pay with WETH
            IWETH(WETH).deposit{value: value}(); // wrap only what is needed to pay
            IWETH(WETH).transfer(recipient, value);
        } else if (payer == address(this)) {
            // pay with tokens already in the contract (for the exact input multihop case)
            IERC20Upgradeable(token).safeTransfer(recipient, value);
        } else {
            // pull payment
            IERC20Upgradeable(token).safeTransferFrom(payer, recipient, value);
        }
    }

    function pause() external onlyOwner {
        require(paused() == false, "paused already");
        _pause();
    }

    function unpause() external onlyOwner {
        require(paused() == true, "unpaused already");
        _unpause();
    }

    // function setWETH(address addr) external onlyOwner {
    //     require(addr != address(0), "invalid addr");
    //     WETH = addr;
    // }

    // function setWhitelistAddr(address addr) external onlyOwner {
    //     require(addr != address(0),"invalid addr");
    //     feeExcludeList[addr] = true;
    // }

    function withdraw(address token, address receiver, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool s,) = payable(receiver).call{value: amount}("");
            require(s, "withdraw native failed");
        } else {
            IERC20Upgradeable(token).safeTransfer(receiver, amount);
        }
    }
}