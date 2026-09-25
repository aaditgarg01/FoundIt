const fs = require('fs');

const zones = ['North Campus', 'South Campus', 'East Campus', 'West Campus', 'Central Hub', 'Sports Complex', 'Residential Area'];
const buildings = {
    'North Campus': ['Library', 'Science Block', 'Engineering Block', 'Computer Centre', 'Auditorium'],
    'South Campus': ['Humanities Block', 'Business School', 'Law Faculty', 'Arts Centre'],
    'East Campus': ['Medical Centre', 'Research Labs', 'Innovation Hub'],
    'West Campus': ['Architecture Block', 'Design Studio', 'Media Centre'],
    'Central Hub': ['Student Union', 'Main Cafeteria', 'Administration', 'Registration Office'],
    'Sports Complex': ['Indoor Stadium', 'Swimming Pool', 'Gymnasium', 'Tennis Courts'],
    'Residential Area': ['Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Dining Hall', 'Guest House']
};

const roomTypes = ['Room', 'Lab', 'Hall', 'Office', 'Entrance', 'Corridor', 'Lounge', 'Cafe'];

const locations = [];

for (const [zone, bldgs] of Object.entries(buildings)) {
    for (const bldg of bldgs) {
        // Create 2-4 locations per building
        const numLocations = Math.floor(Math.random() * 3) + 2;
        for (let i = 1; i <= numLocations; i++) {
            const roomType = roomTypes[Math.floor(Math.random() * roomTypes.length)];
            const roomNumber = Math.floor(Math.random() * 400) + 100;
            const locationName = `${bldg} ${roomType} ${roomNumber}`;
            
            locations.push({
                location_name: locationName,
                building: bldg,
                zone: zone
            });
        }
    }
}

// Make sure we have 60-80 entries
console.log(`Generated ${locations.length} locations`);

fs.writeFileSync('db/scripts/locations_config.json', JSON.stringify(locations, null, 2));
