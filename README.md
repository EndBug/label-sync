# label-sync
[![All Contributors](https://img.shields.io/github/all-contributors/EndBug/label-sync)](#contributors-)

An action that allows you to sync labels from a repository or a config file.

### Example workflow:

```yaml
name: Sync labels
on:
  # You can run this with every type of event, but it's better to run it only when you actually need it.
  workflow_dispatch:

permissions:
  issues: write

jobs:
  labels:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: .github/labels.yml

      - uses: EndBug/label-sync@v2
        with:
          # If you want to use a config file, you can put its path or URL here, multiple files are also allowed (more info in the paragraphs below)
          config-file: .github/labels.yml
          # as URL:
          config-file: https://raw.githubusercontent.com/EndBug/labels/main/labels.yml
          # as multiple:
          config-file: |
            https://raw.githubusercontent.com/EndBug/labels/main/labels.yml
            .github/labels.yml

          # If you want to use a source repo, you can put is name here (only the owner/repo format is accepted)
          source-repo: owner/repo

          # If you're using a private source repo or a URL that needs an 'Authorization' header, you'll need to add a custom token for the action to read it
          request-token: ${{ secrets.YOUR_OWN_SECRET }}

          # If you want to delete any additional label, set this to true
          delete-other-labels: false

          # If you want the action just to show you the preview of the changes, without actually editing the labels, set this to true
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
  - `color` - The color of the label, with or without a leading `#`.
  - `description` - [optional] The description of the label ([max 100 characters](https://docs.github.com/en/rest/issues/labels?apiVersion=2022-11-28#create-a-label)).
  - `aliases` - [optional] An array containing the "aliases" of the label. If an existing label's name is an alias that label will be edited to match your config: this way you don't loose issues and PRs that have been labeled previously.

This is how it would end up looking:

```yaml
- name: A label
  color: '000000'

- name: Another label
  color: '111111'
  description: A very inspiring description

- name: Yet another label
  color: '222222'
  aliases: ['first', 'second', 'third']
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

Note that `color` may be specified in either `000000` or `'#000000'` format. Mind the quotes when using yaml.

If you want to see an actual config file, you can check out the one in this repo [here](https://github.com/EndBug/labels/blob/main/labels.yml).

This action can either read a local file or fetch it from a custom URL.  
If you want to use a URL make sure that the data field of the response contains JSON or YAML text that follows the structure above.

An example of how you may want to use a URL instead of a local file is if you want to use a config file that is located in a GitHub repo, without having to copy it to your own.  
You can use the "raw" link that GitHub provides for the file:

```yaml
- uses: EndBug/label-sync@v2
  with:
    # This is just an example, but any valid URL can be used
    config-file: 'https://raw.githubusercontent.com/EndBug/labels/main/labels.yml'
```

You can also specify several config files (e.g. sync a set of "global" labels as well as a set of "local" labels):

```yaml
- uses: EndBug/label-sync@v2
  with:
    config-file: |
        https://raw.githubusercontent.com/EndBug/labels/main/labels.yml
        .github/labels.yml
```

This is different than using the `source-repo` option, since this also allows you to use aliases, if the config file has any. If you use the `source-repo` option the action will only copy over the missing labels and update colors, without updating or deleting anything else.

If the URL you're using needs an `Authorization` header (like if, for example, you're fetching it from a private repo), you can put its value in the `request-token` input:

```yaml
- uses: EndBug/label-sync@v2
  with:
    config-file: 'https://raw.githubusercontent.com/User/repo-name/path/to/labels.yml'
    # Remember not to put PATs in files, use GitHub secrets instead
    request-token: ${{ secrets.YOUR_CUSTOM_PAT }}
```

The `request-token` input can also be used with a `source-repo`, if that repo is private.

If your URL needs a more elaborate request, it's better if you perform it separately and save its output to a local file. You can then run the action using the local config file you just created.

## Contributors ✨

Thanks go to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/EndBug"><img src="https://avatars.githubusercontent.com/u/26386270?v=4?s=100" width="100px;" alt="Federico Grandi"/><br /><sub><b>Federico Grandi</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=EndBug" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/h1dden-da3m0n"><img src="https://avatars.githubusercontent.com/u/33120068?v=4?s=100" width="100px;" alt="K3rnelPan1c"/><br /><sub><b>K3rnelPan1c</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=h1dden-da3m0n" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/danielwerg"><img src="https://avatars.githubusercontent.com/u/35052399?v=4?s=100" width="100px;" alt="danielwerg"/><br /><sub><b>danielwerg</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=danielwerg" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kenodegard"><img src="https://avatars.githubusercontent.com/u/4546435?v=4?s=100" width="100px;" alt="Ken Odegard"/><br /><sub><b>Ken Odegard</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=kenodegard" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/armsnyder"><img src="https://avatars.githubusercontent.com/u/9969202?v=4?s=100" width="100px;" alt="Adam Snyder"/><br /><sub><b>Adam Snyder</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=armsnyder" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://srealmoreno.com"><img src="https://avatars.githubusercontent.com/u/50985135?v=4?s=100" width="100px;" alt="Salvador real"/><br /><sub><b>Salvador real</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=srealmoreno" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://simbo.de/"><img src="https://avatars.githubusercontent.com/u/647390?v=4?s=100" width="100px;" alt="Simon Lepel"/><br /><sub><b>Simon Lepel</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=simbo" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/carlosrodriguezhernandez/"><img src="https://avatars.githubusercontent.com/u/13216600?v=4?s=100" width="100px;" alt="Carlos Rodríguez Hernández"/><br /><sub><b>Carlos Rodríguez Hernández</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=carrodher" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MaddoScientisto"><img src="https://avatars.githubusercontent.com/u/816014?v=4?s=100" width="100px;" alt="Marco"/><br /><sub><b>Marco</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/issues?q=author%3AMaddoScientisto" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/andrewvaughan"><img src="https://avatars.githubusercontent.com/u/1119590?v=4?s=100" width="100px;" alt="Andrew Vaughan"/><br /><sub><b>Andrew Vaughan</b></sub></a><br /><a href="https://github.com/EndBug/label-sync/commits?author=andrewvaughan" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://linkedin.com/in/reece"><img src="https://avatars.githubusercontent.com/u/109453?v=4?s=100" width="100px;" alt="Reece Hart"/><br /><sub><b>Reece Hart</b></sub></a><br /><a href="#maintenance-reece" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
