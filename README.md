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
        # This is needed in order to edit the labels
        token: ${{ secrets.GITHUB_TOKEN }}
        
        # If you want to use a config file, you can put its path here
        config-file: .github/labels.yml

        # If you want to use a source repo, you can put is name here (only the owner/repo format is accepted)
        source-repo: owner/repo
        # If you're using a private source repo, you'll need to add a custom token for the action to read it
        source-repo-token: ${{ secrets.YOUR_OWN_SECRET }}

        # If you want to delete any additional label, set this to true
        delete-other-labels: false

        #If you want the action just to show you the preview of the changes, without actually editing the labels, set this to tru
        dry-run: true
```

This is only a sample workflow to illustrate all the options: if you want to see an actual workflow you can check the one in this repo [here](.github/workflows/labels.yml).
