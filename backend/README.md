# Getting Started
1. [Install uv](https://docs.astral.sh/uv/getting-started/installation/#installation-methods)
2. Run `uv sync --dev` to install dependencies in a new virtual environment (venv)
If not done before install the pre-commit hooks
3. Run `uv run pre-commit install`
4. Run `uv run pre-commit install --hook-type commit-msg` to install commitlinter

Now you can start coding... To have an optimal coding experience I recommend a few VS Code Plugins:
- ruff to lint and format on save
- git lens to enable inline git blame
- Github CoPilot for AI support (CoPilot is free for students, enable [here](https://github.com/settings/education/benefits?locale=en-US))

## About uv
Uv is a python version, package and environment management tool and allows for dynamic dependency resolution.
You can find more information [here](https://docs.astral.sh/uv/guides/projects/) but a few hints to start:
- To run pre-commit hooks in the venv you can either activate it (`source .venv/bin/activate`) before committing or use `uv run git commit -m "[commit message]`
- To add a dependency use `uv add [dependency]`
    - If it is a dependency only needed for developing purposes (e.g. ruff) add the `--dev` flag

## About ruff
Ruff is a linter and formatter. It is used to check for an coherent coding style and enforcing specific rules, which are configured in the pyproject.toml. In VS Code you can enable formatting on save (if the ruff extension is installed) or pre-commit does it for you (do not forget to re-add your changes again, as pre-commit does not stage its changes automatically).
If you are completely sure about ignoring a rule you can disable it per line via adding a comment `# noqa: [rule code (e.g F408)]`. Please be very careful with disabling rules in code as most rules are there for a reason!
