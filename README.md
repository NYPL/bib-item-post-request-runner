# Bib/Item Post Request Runner

This is a small module for executing bulk post requests against the Bib/Item services.

## Initialization

```
cp config/sample.env config/[environment].env
```

Fill your environment file with meaningful config.

## Running

```
node run TYPE NYPLSOURCE --envfile ENVFILE [--start STARTINGID] [--limit LIMIT] [--batchSize BATCHSIZE] [--batchDelay BATCHDELAY]
```

 * `TYPE`: Either "bibs" or "items".
 * `NYPLSOURCE`: Specify the nyplSource (Must be one of: 'sierra-nypl', 'recap-pul', 'recap-cul')
 * `STARTINGID`: Optional starting id, e.g. '13410675'. Default '0', i.e. the lowest id in the store.
 * `ENVFILE`: Path to local `config/[environment].env` containing API credentials
 * `LIMIT`: Optional integer limit, e.g. 1000. Default is no limit (i.e. process *all*)
 * `BATCHSIZE`: Optional integer batch size, e.g. 100. Default 100.
 * `BATCHDELAY`: Optional integer delay in ms to wait between batches, e.g. 100. Default 0.

For example, this will cause the Bibs service to re-post all `sierra-nypl` bibs into the `Bibs` stream:

```
node run bibs sierra-nypl --envfile config/[env file]
```

And this will post 50K `recap-pul` items starting at id 'id1234567' in batches of 100:

```
node run items recap-pul --start id1234556 --limit 50000 --batchSize 100 --envfile config/[env file]
```

### Processing a single record

Although this tool's primary purpose is bulk processing, it can also be used to process a single bib/item if you know (or can surmise) the id that immediately precedes the record you would like to process. (The bib/item posting service is controlled by specifying the id *above which* to start processing.)

To process `b21415296` (i.e. sierra-nypl, 21415296) invoke the runner with `start` set to the *previous* id (i.e. `21415295`):

```
node run bibs sierra-nypl --start 21415295 --limit 1 --envfile config/[env file]
```

### Processing from a timestamp

Sometimes it's useful to re-post bibs & items from a specific updated timestamp.

To re-post all bibs updated on or after Jun 11, 2018 2am GMT:

```
node run bibs --envfile config/development.env --lastUpdatedDate 2018-06-11T02:00:00Z
```

To re-post all bibs updated between Jun 11, 2018 2am and Jun 12, 2018 2am GMT:

```
node run bibs --envfile config/development.env --lastUpdatedDate 2018-06-11T02:00:00Z --lastUpdatedDateStop 2018-06-12T02:00:00Z
```

Note that when running a repost job using `lastUpdatedDate`, all command line arguments noted above apply (e.g. `--limit`, `--batchsize`) *except* for `--start` and `NYPLSOURCE`, which are only relevant for re-posting by nypl-source & id.

Note also that when re-posting by timestamp, `lastUpdatedDate` is used to paginate. (Normally `lastId` is used.) Because `lastUpdatedDate` is only accurate to the nearest second, multiple bibs can share a `lastUpdatedDate` value, which means we should keep our `batchSize` high lest we miss records. We haven't encountered an instance where `--batchSize 250` encountered probematic patches.

### Processing the whole catalog

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
