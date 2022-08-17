import Task from '../../src/task';
import { TaskRunOptions } from '../../src/types';
import { DeploymentInputs } from './input';

export default async (task: Task, { force, from }: TaskRunOptions = {}): Promise<void> => {
  const input = task.input() as DeploymentInputs;
  const args = [input.admin];
  // TODO: Update contract name
  await task.deployAndVerify('MyContract', args, from, force);
};
