# Security Specification: High Precision Agent Locations

## Data Model & Collection
Collection: `agentLocations/{userId}`
Document ID: `{userId}` (strictly 1 document per agent/user)

### Schema Fields
- `userId` (string, required): Auth UID of the user/agent
- `name` (string, required): Full display name
- `phone` (string, required): Contact phone number
- `memberId` (string, optional): Member identifier code
- `role` (string, optional): Agent role
- `latitude` (number, required): High precision floating point latitude
- `longitude` (number, required): High precision floating point longitude
- `accuracy` (number, required): GPS accuracy radius in meters
- `altitude` (number, optional): GPS altitude in meters
- `heading` (number, optional): Compass orientation heading in degrees
- `speed` (number, optional): Speed in m/s
- `lastUpdated` (string, required): Readable timestamp string
- `lastUpdatedTs` (number, required): Epoch milliseconds timestamp for freshness check
- `isOnline` (boolean, required): Presence status
- `isSharingLocation` (boolean, optional): Privacy share location toggle state
- `profileImage` (string, optional): Avatar image URL
- `city` (string, optional): City/Area name
- `district` (string, optional): District name
- `country` (string, optional): Country name

## Access Rules (ABAC/RBAC)
- **Read**: Authenticated users can read `agentLocations` documents to view nearby agents on the interactive map.
- **Write (Create/Update)**: User can write to `agentLocations/{userId}` ONLY if `request.auth.uid == userId` or matched with the document ID.
- **Delete**: User can delete or disable their own document (`request.auth.uid == userId`) or Admin.

## Security Test Scenarios
1. `test_read_agent_locations`: Authenticated user reads active agent locations -> ALLOW.
2. `test_write_own_agent_location`: User `user123` updates `agentLocations/user123` -> ALLOW.
3. `test_write_other_agent_location`: User `user123` attempts write to `agentLocations/user999` -> DENY.
