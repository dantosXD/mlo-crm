import sqlite3
import json

conn = sqlite3.connect(r'C:\Users\207ds\Desktop\Apps\mlodash-new\mlo-dash-new\features.db')
cursor = conn.cursor()
cursor.execute('SELECT id, category, name, description, steps FROM features WHERE id = 242')
result = cursor.fetchone()

if result:
    print(f"id: {result[0]}")
    print(f"category: {result[1]}")
    print(f"name: {result[2]}")
    print(f"description: {result[3]}")
    print(f"steps: {result[4]}")
else:
    print("No feature found with id=242")

conn.close()
