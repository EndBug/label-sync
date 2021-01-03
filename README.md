# label-sync

An action that allows you to sync labels from a repository or a config file.

### Example workflow:

```yaml
name: Sync labels
on:
  # You can run this with every type of event, but it's better to run it only when you actually need it.
  workflow_dispatch:

jobs:
  labels:
    runs-on: ubuntu-latest

    steps:
      - uses: EndBug/label-sync@v1
        with:
          # If you want to use a config file, you can put its path here (more info in the paragraphs below)
          config-file: .github/labels.yml

          # If you want to use a source repo, you can put is name here (only the owner/repo format is accepted)
          source-repo: owner/repo
          # If you're using a private source repo, you'll need to add a custom token for the action to read it
          source-repo-token: ${{ secrets.YOUR_OWN_SECRET }}

          # If you want to delete any additional label, set this to true
          delete-other-labels: false

          #If you want the action just to show you the preview of the changes, without actually editing the labels, set this to tru
          dry-run: true

          # You can change the token used to change the labels, this is the default one
          token: ${{ secrets.GITHUB_TOKEN }}
```

This is only a sample workflow to illustrate all the options: if you want to see an actual workflow you can check out the one in this repo [here](.github/workflows/labels.yml).

### Config files

If you want to use a config file you can create your own following the instructions below.

If you want to start off by copying the labels from another repository, you can use my [`EndBug/export-label-config` action](https://github.com/EndBug/export-label-config), that will generate one for you.

How to create a config file:

- Create a JSON or YAML file, with one of these extensions: `.json`, `.yaml`, `.yml`.
- Every label should be an array element: add some square brackets `[]` if you need to.
- Every element of the array should be an object with the following properties:
  - `name` - The name of the label.
  - `color` - The color of the label.
  - `description` - [optional] The description of the label.
  - `aliases` - [optional] An array containing the "aliases" of the label. If an existing label's name is an alias that label will be edited to match your config: this way you don't loose issues and PRs that have been labeled previously.

This is how it would end up looking:

```yaml
- name: A label
  color: "000000"

- name: Another label
  color: "111111"
  description: A very inspiring description

- name: Yet another label
  color: "222222"
  aliases: ["first", "second", "third"]
```

```json
[
  {
    "name": "A label",
    "color": "000000"
  },
  {
    "name": "Another label",
    "color": "111111",
    "description": "A very inspiring description"
  },
  {
    "name": "Yet another label",
    "color": "222222",
    "aliases": ["first", "second", "third"]
  }
]
```

If you want to see an actual config file, you can check out the one in this repo [here](.github/labels.yml).
