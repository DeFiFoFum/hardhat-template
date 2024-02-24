import { logger } from '../../../hardhat/utils'
import { getErrorMessage } from '../../utils/getErrorMessage'

/**
  // Usage
  const { pushActionsAndLog, pushActions, getActions, tryActionCatchAndLog } = createActionLog();

  // Example of pushing a single action
  pushActionsAndLog({
    contract: 'minter',
    address: '0xMinterAddress',
    action: '_initialize minter',
  });

  // Example of pushing multiple actions
  pushActionsAndLog([
    {
      contract: 'contract1',
      address: '0xContract1Address',
      action: 'some action',
    },
    {
      contract: 'contract2',
      address: '0xContract2Address',
      action: 'another action',
    }
  ]);

  // When you need to access all actions
  const actions = getActions();
  console.dir(actions);
 */
type Action = {
  contract: string
  address: string
  action: string
}

type ActionOrActions = Action | Action[]

export const createActionLog = () => {
  const ACTIONS: Action[] = []

  const pushActionsAndLog = (actionOrActions: ActionOrActions) => {
    _pushActionsAndLog(actionOrActions)
  }

  const pushActions = (actionOrActions: ActionOrActions) => {
    const noLogging = false
    _pushActionsAndLog(actionOrActions, noLogging)
  }

  const _pushActionsAndLog = (actionOrActions: ActionOrActions, log = true) => {
    const actionsArray = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
    actionsArray.forEach((action) => {
      ACTIONS.push(action)
      logger.log(`Action pushed for ${action.contract}: ${action.action}`, '📌')
      console.dir(action)
    })
  }

  async function tryActionCatchAndLog<T>(action: () => Promise<T>, actionInfo: Action): Promise<T | undefined> {
    try {
      return await action()
    } catch (e) {
      logger.error(
        `Error performing action on ${actionInfo.contract} at address ${actionInfo.address}: ${
          actionInfo.action
        } - ${getErrorMessage(e, 500)}`
      )
      pushActionsAndLog(actionInfo)
    }
  }

  const getActions = () => ACTIONS

  return { pushActionsAndLog, pushActions, getActions, tryActionCatchAndLog }
}
