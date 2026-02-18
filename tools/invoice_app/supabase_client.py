"""
Supabase client initialization using httpx for direct REST API calls
"""
import os
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "generated-pdfs")

class SimpleSupabaseClient:
    """
    Simplified Supabase client using httpx for direct REST API calls
    Avoids the dependency issues with the full supabase-py package
    """
    def __init__(self, url: str, key: str, service_role_key: str = ""):
        if not url or not key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment variables. "
                "Copy .env.example to .env and fill in your Supabase credentials."
            )
        self.url = url
        self.key = key
        self.rest_url = f"{url}/rest/v1"
        # Use service_role key if available (bypasses RLS for server-side operations)
        auth_key = service_role_key if service_role_key and service_role_key != "YOUR_SERVICE_ROLE_KEY_HERE" else key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {auth_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    async def select(self, table: str, columns: str = "*", filters: dict = None, order_by: tuple = None):
        """
        SELECT query
        Args:
            table: Table name
            columns: Columns to select (default: *)
            filters: Dict of column:value filters
            order_by: Tuple of (column, descending: bool)
        """
        async with httpx.AsyncClient() as client:
            params = {"select": columns}

            if filters:
                for key, value in filters.items():
                    params[key] = f"eq.{value}"

            if order_by:
                column, desc = order_by
                params["order"] = f"{column}.{'desc' if desc else 'asc'}"

            response = await client.get(
                f"{self.rest_url}/{table}",
                headers=self.headers,
                params=params
            )
            response.raise_for_status()
            return response.json()

    async def insert(self, table: str, data: dict):
        """INSERT query"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.rest_url}/{table}",
                headers=self.headers,
                json=data
            )
            response.raise_for_status()
            result = response.json()
            return result[0] if result else None

    async def update(self, table: str, data: dict, filters: dict):
        """
        UPDATE query
        Args:
            table: Table name
            data: Data to update
            filters: Dict of column:value filters for WHERE clause
        """
        async with httpx.AsyncClient() as client:
            params = {}
            for key, value in filters.items():
                params[key] = f"eq.{value}"

            response = await client.patch(
                f"{self.rest_url}/{table}",
                headers=self.headers,
                params=params,
                json=data
            )
            response.raise_for_status()
            result = response.json()
            return result[0] if result else None

    async def select_filtered(self, table: str, columns: str = "*", eq_filters: dict = None, gte_filters: dict = None, order_by: tuple = None):
        """
        SELECT with eq and gte filters (useful for date range queries).
        Args:
            table: Table name
            columns: Columns to select
            eq_filters: Dict of column:value for equality filters
            gte_filters: Dict of column:value for greater-than-or-equal filters
            order_by: Tuple of (column, descending: bool)
        """
        async with httpx.AsyncClient() as client:
            params = {"select": columns}
            if eq_filters:
                for key, value in eq_filters.items():
                    params[key] = f"eq.{value}"
            if gte_filters:
                for key, value in gte_filters.items():
                    params[key] = f"gte.{value}"
            if order_by:
                column, desc = order_by
                params["order"] = f"{column}.{'desc' if desc else 'asc'}"
            response = await client.get(
                f"{self.rest_url}/{table}",
                headers=self.headers,
                params=params
            )
            response.raise_for_status()
            return response.json()

    async def select_or(self, table: str, or_filters: str, columns: str = "*", order_by: tuple = None, filters: dict = None):
        """
        SELECT with OR filters using PostgREST syntax.
        Args:
            table: Table name
            or_filters: PostgREST OR filter string, e.g. "(name.ilike.*query*,company_name.ilike.*query*)"
            columns: Columns to select
            order_by: Tuple of (column, descending: bool)
            filters: Optional dict of column:value AND filters (combined with OR)
        """
        async with httpx.AsyncClient() as client:
            params = {"select": columns, "or": or_filters}

            if filters:
                for key, value in filters.items():
                    params[key] = f"eq.{value}"

            if order_by:
                column, desc = order_by
                params["order"] = f"{column}.{'desc' if desc else 'asc'}"

            response = await client.get(
                f"{self.rest_url}/{table}",
                headers=self.headers,
                params=params
            )
            response.raise_for_status()
            return response.json()

    async def delete(self, table: str, filters: dict):
        """
        DELETE query
        Args:
            table: Table name
            filters: Dict of column:value filters for WHERE clause
        """
        async with httpx.AsyncClient() as client:
            params = {}
            for key, value in filters.items():
                params[key] = f"eq.{value}"

            response = await client.delete(
                f"{self.rest_url}/{table}",
                headers=self.headers,
                params=params
            )
            response.raise_for_status()
            result = response.json()
            return result[0] if result else None

# Create a singleton client instance
supabase = SimpleSupabaseClient(SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
