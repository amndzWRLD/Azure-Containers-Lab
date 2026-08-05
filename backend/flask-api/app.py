import os

import pymysql
import pymysql.cursors
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def get_db_connection():
    return pymysql.connect(
        host=os.environ["DB_HOST"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASS"],
        database=os.environ["DB_NAME"],
        cursorclass=pymysql.cursors.DictCursor,
    )


@app.route("/items", methods=["GET"])
def get_items():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name FROM items")
            rows = cursor.fetchall()
        return jsonify(rows), 200
    finally:
        conn.close()


@app.route("/items", methods=["POST"])
def create_item():
    data = request.get_json(silent=True)
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "name is required"}), 400

    name = data["name"].strip()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("INSERT INTO items (name) VALUES (%s)", (name,))
        conn.commit()
        return jsonify({"message": "Item created"}), 201
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
