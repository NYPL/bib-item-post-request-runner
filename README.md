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

# Run the runner on PUL bibs:
node run-all --envfile config/production.env --batchSize 500 --batchDelay 1000

# `[ctrl]-a d` to detach
```

`screen -r` will reattach.

Long term, we should wrap this up as a buildable container.
