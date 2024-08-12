# Modules

This directory is meant to organize git modules added to this repo.

## Current Modules

- See [.gitmodules](../.gitmodules) for the current modules added to this repo.

1. foundry
2. semgrep smart contracts

## Troubleshooting

1. If you see errors like `Source "ds-test/test.sol" not found`, the submodules of the submodules may not be initialized. Run `yarn init:submodules` (`git submodule update --init --recursive`) to initialize all submodules.
2. If you are seeing `Unable to resolve imports` when running `yarn test:forget`, see: [Foundry remapping dependencies](https://book.getfoundry.sh/projects/dependencies?highlight=remappings#remapping-dependencies)
   1. Also, [Using foundry with OpenZeppelin](https://docs.openzeppelin.com/upgrades-plugins/1.x/foundry-upgrades)
