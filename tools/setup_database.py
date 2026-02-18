"""
Database Setup Script
Executes the dashboard extensions SQL to add usage tracking and metadata.

This script requires your Supabase database password.
You can find it in your Supabase Dashboard:
Settings > Database > Connection string > Password
"""
import psycopg2
import sys
import os
from getpass import getpass

def get_connection_string():
    """Construct Postgres connection string from Supabase URL"""
    supabase_url = os.getenv("SUPABASE_URL", "")
    if not supabase_url:
        print("❌ Error: SUPABASE_URL not found in .env")
        sys.exit(1)

    # Extract project ref from URL (e.g., lxwzszymkcdyyfnkuawi from https://lxwzszymkcdyyfnkuawi.supabase.co)
    project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")

    print(f"📍 Supabase Project: {project_ref}")

    # Prompt for password
    password = getpass("🔑 Enter your Supabase database password: ")

    if not password:
        print("❌ Password is required")
        sys.exit(1)

    # Construct connection string
    conn_string = f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres"
    return conn_string

def execute_sql_file(conn_string, sql_file_path):
    """Execute SQL file against Supabase database"""
    print(f"\n📂 Reading SQL file: {sql_file_path}")

    if not os.path.exists(sql_file_path):
        print(f"❌ Error: SQL file not found at {sql_file_path}")
        sys.exit(1)

    with open(sql_file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    print("📡 Connecting to Supabase database...")

    try:
        # Connect to database
        conn = psycopg2.connect(conn_string)
        conn.autocommit = True
        cursor = conn.cursor()

        print("✅ Connected successfully!")
        print("\n🔧 Executing SQL statements...")

        # Execute SQL
        cursor.execute(sql_content)

        # Fetch and display results from verification queries
        try:
            results = cursor.fetchall()
            if results:
                print("\n📊 Results:")
                for row in results:
                    print(f"   {row}")
        except:
            pass

        cursor.close()
        conn.close()

        print("\n✨ Database schema updated successfully!")
        print("   - Added thumbnail_base64 column to templates table")
        print("   - Added payment_status column to templates table")
        print("   - Created usage_logs table")
        print("   - Created indexes for performance")
        print("   - Configured Row Level Security policies")

        return True

    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False

def main():
    print("=" * 60)
    print("  OpenCanvas - Database Setup")
    print("  Dashboard Extensions Installation")
    print("=" * 60)

    # Load .env
    from dotenv import load_dotenv
    load_dotenv()

    # Get connection string
    conn_string = get_connection_string()

    # SQL file path
    sql_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "DASHBOARD_EXTENSIONS.sql")

    # Execute SQL
    success = execute_sql_file(conn_string, sql_file)

    if success:
        print("\n🎉 Setup complete! You can now restart the server.")
        sys.exit(0)
    else:
        print("\n⚠️  Setup failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup cancelled by user.")
        sys.exit(1)
