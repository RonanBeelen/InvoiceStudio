"""
Invoice Studio - New Tables Setup
Creates company_settings, customers, and documents tables.

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
        print("Error: SUPABASE_URL not found in .env")
        sys.exit(1)

    project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
    print(f"Supabase Project: {project_ref}")

    password = getpass("Enter your Supabase database password: ")
    if not password:
        print("Error: Password is required")
        sys.exit(1)

    return f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres"


def execute_sql_file(conn_string, sql_file_path):
    """Execute SQL file against Supabase database"""
    print(f"\nReading SQL file: {sql_file_path}")

    if not os.path.exists(sql_file_path):
        print(f"Error: SQL file not found at {sql_file_path}")
        sys.exit(1)

    with open(sql_file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    print("Connecting to Supabase database...")

    try:
        conn = psycopg2.connect(conn_string)
        conn.autocommit = True
        cursor = conn.cursor()

        print("Connected successfully!")
        print("\nExecuting SQL statements...")

        cursor.execute(sql_content)

        try:
            results = cursor.fetchall()
            if results:
                print("\nResults:")
                for row in results:
                    print(f"   {row}")
        except Exception:
            pass

        cursor.close()
        conn.close()

        print("\nDatabase tables created successfully!")
        print("   - company_settings (company details & preferences)")
        print("   - customers (customer address book)")
        print("   - documents (invoices & quotes tracking)")
        print("   - Indexes, RLS policies, and triggers configured")

        return True

    except psycopg2.Error as e:
        print(f"\nDatabase error: {e}")
        return False
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        return False


def main():
    print("=" * 60)
    print("  Invoice Studio - New Tables Setup")
    print("  company_settings, customers, documents")
    print("=" * 60)

    from dotenv import load_dotenv
    load_dotenv()

    conn_string = get_connection_string()

    sql_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "docs",
        "INVOICE_STUDIO_TABLES.sql"
    )

    success = execute_sql_file(conn_string, sql_file)

    if success:
        print("\nSetup complete! You can now restart the server.")
        sys.exit(0)
    else:
        print("\nSetup failed. Please check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nSetup cancelled by user.")
        sys.exit(1)
