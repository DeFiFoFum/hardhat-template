# DelegateCallLib Usage

```js
    function _createGauge(
        address _pool,
        uint256 _gaugeType
    ) internal returns (address _gauge, address _internal_bribe, address _external_bribe) {
        (bool success, bytes memory initialResult) = address(gaugeLogic).delegatecall(
            abi.encodeWithSelector(IVoterV5_GaugeLogic.createGauge.selector, _pool, _gaugeType)
        );
        bytes memory result = DelegateCallLib.handleDelegateCallResult(success, initialResult);

        // Decode the result
        (_gauge, _internal_bribe, _external_bribe) = abi.decode(result, (address, address, address));

        emit GaugeCreated(_gauge, msg.sender, _internal_bribe, _external_bribe, _pool);
    }
```
