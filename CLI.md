# CREATE
orbitdb create /database1 <type>

# GET
eventlog, docstore, counter, feed, keyvalue:
orbitdb get /database1 [<search]

# UPDATE
eventlog, feed:
orbitdb add /database1 <value>
docstore:
orbitdb put /database1 <value>
keyvalue:
orbitdb set /database1 <key> <value>
counter:
orbitdb inc /database1 <value>
orbitdb dec /database1 <value>

# DELETE
feed, docstore, keyvalue:
orbitdb del /database <hash|key>

* can't delete from counter or eventlog

# REPLICATE
orbitdb replicate /database1

# DROP
orbitdb drop /database1 <confirm>

# ACCESS
orbitdb access /database1 <id> <access>

# INFO
orbitdb info /database1


# create a database
orbitdb eventlog create /database1
orbitdb create eventlog /database1
orbitdb /database1 create eventlog

> /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1

# show address
orbitdb info /database1 --address
orbitdb /database1

> /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1
> "Database '/database1' doesn't exists."

# add event to eventlog (refer with local path)
orbitdb eventlog add /database1 "hello world"
orbitdb add /database1 "hello world"
orbitdb /database1 add "hello world"

# show last 10 from an eventlog
orbitdb eventlog get /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1 --limit 10
orbitdb get /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1 --limit 10
orbitdb /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1 get --limit 10

# replicate a database
orbitdb eventlog replicate /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1 --progress
orbitdb replicate /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1 --progress
orbitdb /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1 replicate  --progress

# give write access to another user
orbitdb eventlog access add /database1 QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQl write
orbitdb access add /database1 QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQl write
orbitdb /database1 access add QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQl write

# revoke write access from another user
orbitdb eventlog access remove /database1 QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQl write
orbitdb access remove /database1 QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQl write
orbitdb /database1 QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQl access remove write

> /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database1/replication

# add a document
orbitdb docstore put /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2 haadcode "{head: QmeP31dZHYB38rS1Smvjzpee7mrp37k4Rnb7EiBu79fw9p}""
orbitdb put /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2 haadcode "{head: QmeP31dZHYB38rS1Smvjzpee7mrp37k4Rnb7EiBu79fw9p}""
orbitdb /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2 put haadcode "{head: QmeP31dZHYB38rS1Smvjzpee7mrp37k4Rnb7EiBu79fw9p}""

> /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2/QmRnZj4stiKoesoA2LPUdWXe2GFmCtRCU9QdKjiRYZtRqF

# search for a document
orbitdb docstore search /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2 haadcode
orbitdb search /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2 haadcode
orbitdb /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2 search haadcode

> [{head: QmeP31dZHYB38rS1Smvjzpee7mrp37k4Rnb7EiBu79fw9p}]

# remove document
orbitdb docstore delete /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2/QmRnZj4stiKoesoA2LPUdWXe2GFmCtRCU9QdKjiRYZtRqF
orbitdb delete /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2/QmRnZj4stiKoesoA2LPUdWXe2GFmCtRCU9QdKjiRYZtRqF
orbitdb /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database2/QmRnZj4stiKoesoA2LPUdWXe2GFmCtRCU9QdKjiRYZtRqF delete

# add feed entry
orbitdb feed add /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database3 "{title:'hello',content:'world'}"

> /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database6/QmRBN8JcBFa1UYkExxzmKwWr9uQKHY6LvAB3bCiLXUXPgf

# remove feed entry
orbitdb feed delete /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database3/QmRBN8JcBFa1UYkExxzmKwWr9uQKHY6LvAB3bCiLXUXPgf

# set key-value
orbitdb kvstore set /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database4 score 1000

# delete key-value
orbitdb kvstore delete /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database4/score

# increase counter by 2
orbitdb counter inc /orbitdb/QmZxxGJAUrFSxC6Y2P4u9e8Hne2GrFcYRaG7mugkCwkjQk/database5 2
