# Task 20xxxxxx-template
Use this directory as a template for creating new tasks

## Setup
1. Copy the parent directory of this `readme.md` into the `tasks/` directory and replace `xxxxxx` with the current date and `-template` with a name for the task.
2. `yarn compile` all contracts
3. [artifacts/](../../artifacts/) will contain the needed JSON files in the [build-info/](../../artifacts/build-info/) and [contracts/](../../artifacts/contracts/) dirs.
4. Copy [contracts/](../../artifacts/contracts/) needed files into the `contract-artifacts` task directory
5. Copy and rename the proper [build-info/](../../artifacts/build-info/) files into the `build-info` task directory. (_`build-info` files have unreadable names. Check the `contracts/<contract-name>.dbg` for the link to the proper `build-info` file._)
6. Update `index.ts` and `input.ts` in the task directory to finish configuring the task.