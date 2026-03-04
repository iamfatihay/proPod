"""Clean up test rooms from 100ms dashboard."""
import asyncio
import httpx
from app.services.hms_service import generate_management_token

HMS_API_BASE = "https://api.100ms.live/v2"


async def list_rooms():
    """List all rooms."""
    token = generate_management_token()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{HMS_API_BASE}/rooms",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    response.raise_for_status()
    return response.json()


async def disable_room(room_id: str):
    """Disable a room (soft delete)."""
    token = generate_management_token()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{HMS_API_BASE}/rooms/{room_id}/disable",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    response.raise_for_status()
    return response.json()


async def main():
    """List and optionally disable test rooms."""
    print("Fetching rooms from 100ms...")
    result = await list_rooms()
    
    rooms = result.get("data", [])
    print(f"\nFound {len(rooms)} rooms:")
    print("-" * 80)
    
    for idx, room in enumerate(rooms, 1):
        room_id = room.get("id")
        room_name = room.get("name")
        enabled = room.get("enabled", False)
        created_at = room.get("created_at", "N/A")
        
        status = "ACTIVE" if enabled else "DISABLED"
        print(f"{idx}. [{status}] {room_name}")
        print(f"   ID: {room_id}")
        print(f"   Created: {created_at}")
        print()
    
    print("-" * 80)
    choice = input("\nDisable all ACTIVE rooms? (yes/no): ").strip().lower()
    
    if choice in ("yes", "y"):
        active_rooms = [r for r in rooms if r.get("enabled", False)]
        print(f"\nDisabling {len(active_rooms)} active rooms...")
        
        for room in active_rooms:
            room_id = room.get("id")
            room_name = room.get("name")
            try:
                await disable_room(room_id)
                print(f"✓ Disabled: {room_name}")
            except Exception as e:
                print(f"✗ Failed to disable {room_name}: {e}")
        
        print("\n✅ Cleanup complete!")
    else:
        print("\nCancelled - no rooms were disabled.")


if __name__ == "__main__":
    asyncio.run(main())
