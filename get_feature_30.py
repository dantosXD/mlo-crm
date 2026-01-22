import sqlite3

conn = sqlite3.connect('features.db')
cur = conn.cursor()
cur.execute('SELECT id, priority, category, name, description, steps FROM features WHERE id = 30')
row = cur.fetchone()

if row:
    print(f"ID: {row[0]}")
    print(f"Priority: {row[1]}")
    print(f"Category: {row[2]}")
    print(f"Name: {row[3]}")
    print(f"Description: {row[4]}")
    print(f"Steps: {row[5]}")
else:
    print("Feature #30 not found")

conn.close()
