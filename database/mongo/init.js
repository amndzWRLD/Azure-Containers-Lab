db = db.getSiblingDB('appdb');

db.createCollection('items');

db.createUser({
    user: 'appuser',
    pwd: 'P@ssw0rd!',
    roles: [
        {
            role: 'readWrite',
            db: 'appdb'
        }
    ]
});
