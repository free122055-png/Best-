with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's locate the general tab start and replace the top sections with sleek, compact, 4-in-a-row layout
p_start = text.find("adminTab === 'general' && (")
if p_start == -1:
    print("Could not find adminTab === 'general'")
    exit(1)

# Find the end of the 8-category hub
p_hub_end = text.find("{/* ⏳ পেন্ডিং সমবায় সদস্য আবেদনপত্র দ্রুত নিয়ন্ত্রণ বক্স */}")
if p_hub_end == -1:
    print("Could not find p_hub_end")
    exit(1)

print("Found bounds:", p_start, p_hub_end)
