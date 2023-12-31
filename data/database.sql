CREATE TABLE users(id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, timezone TEXT, create_date INTEGER NOT NULL);

CREATE TABLE currencies(code TEXT NOT NULL PRIMARY KEY, name TEXT, symbol TEXT, is_active INTEGER NOT NULL, create_date INTEGER NOT NULL);
CREATE TABLE labels(
    id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT NOT NULL, color TEXT, is_active INTEGER NOT NULL, create_date INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE categories(
    id INTEGER PRIMARY KEY, user_id INTEGER, parent_id INTEGER, name TEXT NOT NULL, color TEXT, is_active INTEGER NOT NULL, create_date INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE accounts(
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, currency_code TEXT NOT NULL, name TEXT NOT NULL, start_amount INTEGER NOT NULL, color TEXT, is_active INTEGER NOT NULL, create_date INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (currency_code) REFERENCES currencies(code) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE records(
    id INTEGER PRIMARY KEY, src_account_id INTEGER, src_amount INTEGER NOT NULL, dst_account_id INTEGER, dst_amount INTEGER NOT NULL, note TEXT NOT NULL, category_id INTEGER, date INTEGER NOT NULL, create_date INTEGER NOT NULL,
    FOREIGN KEY (src_account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (dst_account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE TABLE record_labels(
    record_id INTEGER NOT NULL, label_id INTEGER NOT NULL, create_date INTEGER NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (record_id, label_id)
);

CREATE TABLE user_invites(
    id INTEGER PRIMARY KEY NOT NULL, inviting_user_id INTEGER NOT NULL, invite_date INTEGER NOT NULL, expire_date INTEGER NOT NULL,
    FOREIGN KEY (inviting_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE filters(
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, filter_type INTEGER NOT NULL, date_from INTEGER, date_until INTEGER, create_date INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE temp_records(
    user_id INTEGER NOT NULL, src_account_id INTEGER, src_amount INTEGER NOT NULL, dst_account_id INTEGER, dst_amount INTEGER NOT NULL, note TEXT NOT NULL, category_id INTEGER, date INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (src_account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (dst_account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
    PRIMARY KEY (user_id)
);
CREATE TABLE temp_record_labels(
    user_id INTEGER NOT NULL, label_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, label_id)
);
