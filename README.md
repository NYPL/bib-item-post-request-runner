# Bib/Item Post Request Runner

This is a small module for executing bulk post requests against the Bib/Item services.

## Initialization

```
cp config/sample.env config/[environment].env
```

Fill your environment file with meaningful config.

## Running

The basis for all calls is as follows:

```
node run TYPE NYPLSOURCE --envfile ENVFILE \
 [--limit LIMIT] \
 [--batchSize BATCHSIZE] \
 [--batchDelay BATCHDELAY]
 ...
```

 * `TYPE`: **Required:** Either "bibs" or "items".
 * `NYPLSOURCE`: **Usually Required:** (Not required for certain invocations using `--csv`.) Specify the nyplSource (Must be one of: 'sierra-nypl', 'recap-pul', 'recap-cul')
 * `ENVFILE`: **Required:** path to local `config/[environment].env` containing API credentials
 * `BATCHSIZE`: Optional integer batch size, e.g. 100. Default 100.
 * `BATCHDELAY`: Optional integer delay in ms to wait between batches, e.g. 100. Default 0.
 * `LIMIT`: Optional integer limit, e.g. 1000. Default is no limit (i.e. process *all*)

Without any other qualifiers, the above will process records starting from id '0' (i.e. *all* records up to `limit`). See below for adding additional qualifiers to narrow the scope:

### Processing from a timestamp

Sometimes it's useful to re-post bibs & items from a specific updated timestamp.

```
node run TYPE NYPLSOURCE --envfile ENVFILE [--lastUpdatedDate UPDATEDDATE]
```

 * `UPDATEDDATE`: Optional ISO 8601 formatted datetime, e.g. "2018-06-11T02:00:00Z"

For example, to re-post all bibs updated on or after Jun 11, 2018 2am GMT:

```
node run bibs --envfile config/development.env --lastUpdatedDate 2018-06-11T02:00:00Z
```

To re-post all bibs updated between Jun 11, 2018 2am and Jun 12, 2018 2am GMT:

```
node run bibs --envfile config/development.env --lastUpdatedDate 2018-06-11T02:00:00Z --lastUpdatedStop 2018-06-12T02:00:00Z
```

Note that when running a repost job using `lastUpdatedDate`, all command line arguments noted above apply (e.g. `--limit`, `--batchsize`) *except* for `--start` and `NYPLSOURCE`, which are only relevant for re-posting by nypl-source & id.

Note also that when re-posting by timestamp, `lastUpdatedDate` is used to paginate. (Normally `lastId` is used.) Because `lastUpdatedDate` is only accurate to the nearest second, multiple bibs can share a `lastUpdatedDate` value, which means we should keep our `batchSize` high lest we miss records. We haven't encountered an instance where `--batchSize 250` encountered probematic patches.

### Run alphabetically over a set of ids (aka *processing everything*)

Processing by `id` ascending is useful for processing very large batches of records - in particular for processing *all* records because sorting by `id` is a little arbitrary. Note that id "1000" will be processed before id "200" because the ids are stored as Strings.

```
node run TYPE NYPLSOURCE --envfile ENVFILE [--start STARTINGID]
```

 * `STARTINGID`: Optional starting id, e.g. '13410675'. Default '0', i.e. the lowest id in the store.

For example, this will cause the Bibs service to re-post all `sierra-nypl` bibs into the `Bibs` stream:

```
node run bibs sierra-nypl --envfile config/[env file]
```

And this will post 50K `recap-pul` items starting at id 'id1234567' in batches of 100:

```
node run items recap-pul --start id1234556 --limit 50000 --batchSize 100 --envfile config/[env file]
```

```
node run TYPE NYPLSOURCE --envfile ENVFILE [--start STARTINGID] [--ids IDS] [--limit LIMIT] [--batchSize BATCHSIZE] [--batchDelay BATCHDELAY]
```

### Processing a specific id or set of ids:

```
node run TYPE NYPLSOURCE --envfile ENVFILE [--ids IDS]
```

 * `IDS`: List of specific ids to process, e.g. '13410675,13410675'.

To process `b21415296` (i.e. sierra-nypl, 21415296):

```
node run bibs sierra-nypl --envfile ENVFILE --ids 21415295
```

To process sierra-nypl bibs 1234 & 4567:

```
node run bibs sierra-nypl --envfile ENVFILE --ids 1234,4567
```

### Processing a batch of ids from a CSV:

```
node run TYPE NYPLSOURCE --envfile ENVFILE [--csv CSV]
```

 * `CSV`: Path to a CSV containing a single column containing bib ids, e.g. '13410675\n13410675'.

For example, to process all bibs identified in `bibids.csv`:

```
node run bibs sierra-nypl --envfile config/qa.env --csv bibids.csv
```

### Processing a batch of prefixed ids (e.g. 'b1234', 'cb4567') from a CSV:

Sometimes the input has prefixed ids because you need to index records from multiple institutions. One common source of such a CSV is the [identify-ids-by-query](https://github.com/NYPL/discovery-hybrid-indexer/blob/development/scripts/identify-ids-by-query.js) script (i.e. run without `--stripprefix`).

If the CSV contains prefixed ids, you can leave off the `NYPLSOURCE` argument to process it as follows:

```
node run TYPE --envfile ENVFILE [--csv CSV]
```

The script will determine `nyplSource` for each row by id prefix and submit the ids in appropriate batches.

### Processing the whole catalog (i.e. bibs & items from all partners)

A special script is provided to invoke multiple concurrent post runners on each of the known source/type pairs (e.g. sierra-nypl/bib, sierra-nypl/item, recap-pul/bib, etc.).

```
node run-all --envfile ENVFILE [--batchSize BATCHSIZE] [--batchDelay BATCHDELAY]
```

## EC2 Server

This script is currently deployed to a t2.micro EC2 ("i-0292519e23afa7cb4") in nypl-sandbox. A [build-ec2.sh](build-ec2.sh) script is included to document setting up the basic environment.

The current practice is to invoke a `run-all` job via `screen`, as in:

```
# Start a screen session:
screen

# Process all bibs & items:
node run-all --envfile config/production.env --batchSize 500 --batchDelay 1000

# `[ctrl]-a d` to detach

tail -f logs/[env]-all.log
```

`screen -r` will reattach.

Long term, we should wrap this up as a buildable container.
