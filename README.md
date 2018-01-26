# Bib/Item Reposter Runner

This is a small module for executing bulk repost requests against the Bib/Item services.

## Initialization

```
cp config/sample.env config/[environment].env
```

Fill your environment file with meaningful config.

## Running

```
node index TYPE [STARTINGID] [--limit LIMIT] [--batchSize BATCHSIZE]
```

 * `TYPE`: Either "bibs" or "items".
 * `STARTINGID`: Optional starting id, e.g. 'b13410675'. Default '0', i.e. the lowest id in the store.
 * `LIMIT`: Optional integer limit, e.g. 100. Default 100.
 * `BATCHSIZE`: Optional integer limit, e.g. 100. Default 100.
