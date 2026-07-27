import csv
import json
import re
import os

INPUT_CSV = "/Volumes/umr_drive/Documents/insidekhi-nextjs/listings-all - listings-all.csv"
OUTPUT_CSV = "/Volumes/umr_drive/Documents/insidekhi-nextjs/exports/classified_first_100_listings.csv"

TAXONOMY_MAP = {
    # Food & Dining
    "restaurants-cafes": ("Food & Dining", "Restaurants & Cafes", "FOOD_RESTAURANTS_CAFES"),
    "fast-food-street-food": ("Food & Dining", "Fast Food & Street Food", "FOOD_FAST_FOOD"),
    "pakistani-desi-cuisine": ("Food & Dining", "Pakistani & Desi Cuisine", "FOOD_PAKISTANI_DESI"),
    "bakeries-desserts": ("Food & Dining", "Bakeries & Desserts", "FOOD_BAKERIES_DESSERTS"),
    "groceries-fresh-food": ("Food & Dining", "Groceries & Fresh Food", "FOOD_GROCERIES"),
    
    # Shopping & Fashion
    "apparel-clothing": ("Shopping & Fashion", "Apparel & Clothing", "SHOPPING_APPAREL"),
    "footwear-bags": ("Shopping & Fashion", "Footwear & Bags", "SHOPPING_FOOTWEAR_BAGS"),
    "jewelry-watches": ("Shopping & Fashion", "Jewelry & Watches", "SHOPPING_JEWELRY_WATCHES"),
    "electronics-gadgets": ("Shopping & Fashion", "Electronics & Gadgets", "SHOPPING_ELECTRONICS"),
    "home-living": ("Shopping & Fashion", "Home & Living", "SHOPPING_HOME_LIVING"),
    "books-stationery": ("Shopping & Fashion", "Books & Stationery", "SHOPPING_BOOKS"),
    "shopping-malls-outlets": ("Shopping & Fashion", "Shopping Malls & Outlets", "SHOPPING_MALLS"),
    "e-commerce-online-stores": ("Shopping & Fashion", "E-Commerce & Online Stores", "SHOPPING_ECOMMERCE"),

    # Health & Wellness
    "pharmacies-medical-stores": ("Health & Wellness", "Pharmacies & Medical Stores", "HEALTH_PHARMACIES"),
    "clinics-hospitals": ("Health & Wellness", "Clinics & Hospitals", "HEALTH_HOSPITALS"),
    "dental-eye-care": ("Health & Wellness", "Dental & Eye Care", "HEALTH_DENTAL_EYE"),

    # Beauty & Personal Care
    "salons-spas": ("Beauty & Personal Care", "Salons & Spas", "BEAUTY_SALONS_SPAS"),
    "cosmetics-fragrances": ("Beauty & Personal Care", "Cosmetics & Fragrances", "BEAUTY_COSMETICS"),

    # Services & Living
    "travel-tourism": ("Services & Living", "Travel & Tourism", "SERVICES_TRAVEL"),
    "real-estate-venues-rentals": ("Services & Living", "Real Estate, Venues & Rentals", "SERVICES_REAL_ESTATE"),
    "entertainment-recreation": ("Services & Living", "Entertainment & Recreation", "SERVICES_ENTERTAINMENT"),
    "professional-business-services": ("Services & Living", "Professional & Business Services", "SERVICES_PROFESSIONAL"),
    "automotive-transportation-services": ("Services & Living", "Automotive & Transportation Services", "SERVICES_AUTOMOTIVE"),

    # Education & Learning
    "schools-pre-schools": ("Education & Learning", "Schools & Pre-Schools", "EDUCATION_SCHOOLS"),
    "colleges-universities-institutes": ("Education & Learning", "Colleges, Universities & Institutes", "EDUCATION_COLLEGES")
}

TAG_TO_KEY = {
    "Buffet": "restaurants-cafes",
    "Lunch": "restaurants-cafes",
    "Dinner": "restaurants-cafes",
    "Breakfast": "restaurants-cafes",
    "Pakistani": "pakistani-desi-cuisine",
    "Chinese": "restaurants-cafes",
    "Seafood": "restaurants-cafes",
    "Continental": "restaurants-cafes",
    "Turkish": "restaurants-cafes",
    "Italian": "restaurants-cafes",
    "Japanese": "restaurants-cafes",
    "Steaks": "restaurants-cafes",
    "Arabian": "restaurants-cafes",
    "Dhaba": "pakistani-desi-cuisine",
    "Kids Menu": "restaurants-cafes",
    "Pasta": "restaurants-cafes",
    "Sushi": "restaurants-cafes",
    "Afghani": "pakistani-desi-cuisine",
    "Iranian": "pakistani-desi-cuisine",
    "Mandi": "pakistani-desi-cuisine",
    "Indian": "pakistani-desi-cuisine",
    "Ambience": "restaurants-cafes",
    "HomeChef": "restaurants-cafes",
    "Chaat": "fast-food-street-food",
    "Lebanese": "restaurants-cafes",

    "Fast Food": "fast-food-street-food",
    "Burgers": "fast-food-street-food",
    "Pizza": "fast-food-street-food",
    "Fries": "fast-food-street-food",
    "Sandwiches": "fast-food-street-food",
    "Shawarma": "fast-food-street-food",
    "Snacks": "fast-food-street-food",

    "BBQ": "pakistani-desi-cuisine",
    "Biryani": "pakistani-desi-cuisine",
    "Karahi": "pakistani-desi-cuisine",
    "Nihari": "pakistani-desi-cuisine",
    "Best-Biryani": "pakistani-desi-cuisine",

    "Bakery": "bakeries-desserts",
    "Dessert": "bakeries-desserts",
    "Ice Cream": "bakeries-desserts",
    "Shakes": "bakeries-desserts",
    "Tea": "bakeries-desserts",
    "Coffee": "bakeries-desserts",
    "Beverages": "bakeries-desserts",
    "Sweets": "bakeries-desserts",
    "Cakes": "bakeries-desserts",
    "Nimco": "bakeries-desserts",

    "Meat": "groceries-fresh-food",
    "Mineral Water": "groceries-fresh-food",
    "Frozen Food": "groceries-fresh-food",
    "Grocery": "groceries-fresh-food",
    "Fresh Vegetables / Fruits": "groceries-fresh-food",

    "Women's Wear": "apparel-clothing",
    "Men's Wear": "apparel-clothing",
    "Kid's Wear": "apparel-clothing",
    "Baby Shop": "apparel-clothing",
    "Sports Wear": "apparel-clothing",

    "Footwear": "footwear-bags",
    "Shoes": "footwear-bags",
    "Bags": "footwear-bags",
    "Accessories": "footwear-bags",

    "Jewelry": "jewelry-watches",
    "Watches": "jewelry-watches",

    "Phones": "electronics-gadgets",
    "TVs & Electronics": "electronics-gadgets",
    "Electronics": "electronics-gadgets",
    "Mobile Accessories": "electronics-gadgets",
    "Computers": "electronics-gadgets",
    "Gaming Centers": "electronics-gadgets",
    "Gaming Consoles": "electronics-gadgets",

    "Home Appliances": "home-living",
    "Furniture": "home-living",
    "Home Decor": "home-living",
    "Kitchen": "home-living",
    "Carpet": "home-living",

    "Book Shop": "books-stationery",
    "Stationery Shop": "books-stationery",

    "Malls": "shopping-malls-outlets",
    "E-Store": "e-commerce-online-stores",
    "e-stores": "e-commerce-online-stores",

    "Pharmacy": "pharmacies-medical-stores",
    "Medical Store": "pharmacies-medical-stores",
    "Chemist": "pharmacies-medical-stores",
    "Online Pharmacy": "pharmacies-medical-stores",
    "pharmacy": "pharmacies-medical-stores",

    "Hospitals": "clinics-hospitals",
    "Labs": "clinics-hospitals",
    "Clinics": "clinics-hospitals",
    "Blood Banks": "clinics-hospitals",

    "Dental": "dental-eye-care",
    "Eye Wear": "dental-eye-care",
    "Optics": "dental-eye-care",
    "Eye Clinics": "dental-eye-care",

    "Spa & Salons": "salons-spas",
    "Beauty Parlours": "salons-spas",
    "Barber": "salons-spas",

    "Fragrances": "cosmetics-fragrances",
    "Makeup": "cosmetics-fragrances",
    "Cosmetics": "cosmetics-fragrances",

    "Travel": "travel-tourism",
    "Tour Planner": "travel-tourism",
    "Tour": "travel-tourism",
    "Hotels": "travel-tourism",
    "Transportation": "travel-tourism",
    "Tourist Services": "travel-tourism",
    "Airline": "travel-tourism",

    "Farmhouse": "real-estate-venues-rentals",
    "Farm House & Beach": "real-estate-venues-rentals",
    "Real Estates": "real-estate-venues-rentals",
    "Event Planner": "real-estate-venues-rentals",

    "Gym": "entertainment-recreation",
    "Play Area": "entertainment-recreation",
    "Sports": "entertainment-recreation",
    "Cinema": "entertainment-recreation",
    "Amusement Parks": "entertainment-recreation",
    "Zoo": "entertainment-recreation",
    "Fitness Item": "entertainment-recreation",
    "Water Parks": "entertainment-recreation",
    "Recreational": "entertainment-recreation",
    "Swimming Pool": "entertainment-recreation",
    "Club": "entertainment-recreation",
    "Fitness Centers": "entertainment-recreation",

    "Photography": "professional-business-services",
    "Corporate Services": "professional-business-services",
    "IT Services": "professional-business-services",
    "Qurbani-Services": "professional-business-services",
    "Courier": "professional-business-services",

    "Automakers": "automotive-transportation-services",
    "Automobiles": "automotive-transportation-services",
    "Car Repair": "automotive-transportation-services",
    "Garage": "automotive-transportation-services",
    "Auto Parts": "automotive-transportation-services",
    "Mechanic": "automotive-transportation-services",
    "Rental Cars": "automotive-transportation-services",

    "Schools": "schools-pre-schools",
    "Montessories": "schools-pre-schools",
    "Colleges": "colleges-universities-institutes",
    "Universities": "colleges-universities-institutes",
    "Coaching": "colleges-universities-institutes",
    "Institutes": "colleges-universities-institutes",
    "Short courses": "colleges-universities-institutes"
}

def extract_tags(custom_attrs_str):
    if not custom_attrs_str:
        return []
    try:
        data = json.loads(custom_attrs_str)
        tags = []
        if isinstance(data, dict):
            peekaboo_tags = data.get("peekaboo_tags", [])
            if isinstance(peekaboo_tags, list):
                for t in peekaboo_tags:
                    if isinstance(t, dict) and "tag" in t:
                        tags.append(t["tag"])
            add_info = data.get("additional_info", {})
            if isinstance(add_info, dict):
                add_tags = add_info.get("peekaboo_tags", [])
                if isinstance(add_tags, list):
                    for t in add_tags:
                        if isinstance(t, dict) and "tag" in t:
                            tags.append(t["tag"])
        return list(set(tags))
    except Exception:
        return []

def classify_row(row):
    name = (row.get("name") or "").strip()
    desc = (row.get("description") or "").strip()
    custom_attrs = row.get("custom_attributes", "")
    tags = extract_tags(custom_attrs)

    # Combined text representation
    text_to_check = f"{name} {desc} {' '.join(tags)}".lower()

    key_scores = {}

    # 1. Peekaboo Tags
    for tag in tags:
        if tag in TAG_TO_KEY:
            target_key = TAG_TO_KEY[tag]
            key_scores[target_key] = key_scores.get(target_key, 0.0) + 0.8

    # 2. Rich Description & Name Semantic Rules (high weight for explicit description context)
    semantic_patterns = [
        # Cafes & Coffee
        (r"\b(caf[eé]|coffee|espresso|cappuccino|barista)\b", "restaurants-cafes", 0.9),
        (r"\b(buffet|fine dining|hotpot|continental|italian|chinese|japanese|steak|dining)\b", "restaurants-cafes", 0.85),
        
        # Fast Food & Street Food
        (r"\b(burger|burgers|pizza|pizzas|fries|fry|shawarma|fast food|grlling|donut burger)\b", "fast-food-street-food", 0.9),

        # Desi & Pakistani
        (r"\b(bbq|biryani|nihari|karahi|desi|afghani|mandi|dhaba)\b", "pakistani-desi-cuisine", 0.9),

        # Bakeries & Desserts & Shakes
        (r"\b(bakery|dessert|desserts|ice cream|shakes|waffle|pastry|cakes|sweets|nimco|soda)\b", "bakeries-desserts", 0.9),

        # Groceries
        (r"\b(grocery|groceries|fresh vegetables|fruits|frozen food|meat shop|fresh meat)\b", "groceries-fresh-food", 0.85),

        # Apparel & Clothing
        (r"\b(garment|garments|clothing|apparel|mens wear|men's wear|ladies|women's wear|kids wear|baby shop|denim|dresses|bridal dress|party wear|casual dresses|collection|collections)\b", "apparel-clothing", 0.9),

        # Footwear & Bags
        (r"\b(shoes|footwear|bags|leather bags)\b", "footwear-bags", 0.9),

        # Electronics & Gadgets
        (r"\b(mobile|mobiles|phone|phones|communication|computer|computers|electronics|electronic store|gaming|tv|tvs|accessories)\b", "electronics-gadgets", 0.85),

        # Stationery & Books
        (r"\b(stationary|stationery|book shop|bookstore)\b", "books-stationery", 0.85),

        # Home & Living / Gifts
        (r"\b(gift shop|gifts|flowers|home decor|furniture|appliances|kitchenware|carpet)\b", "home-living", 0.75),

        # E-Commerce & Online Stores
        (r"\b(online shopping|e-commerce|e-store|online store|deals around the clock|24hours\.pk)\b", "e-commerce-online-stores", 0.85),

        # Health & Wellness
        (r"\b(medical store|pharmacy|chemist)\b", "pharmacies-medical-stores", 0.9),
        (r"\b(hospital|hospitals|clinic|clinics|labs|blood bank)\b", "clinics-hospitals", 0.9),
        (r"\b(dental|dentist|eye care|optics|eyewear)\b", "dental-eye-care", 0.9),

        # Beauty & Salons
        (r"\b(salon|salons|ladies salon|spa|beauty parlour|barber|aesthetic|cosmetic treatment)\b", "salons-spas", 0.9),
        (r"\b(cosmetics|makeup|fragrances|perfume)\b", "cosmetics-fragrances", 0.85),

        # Travel & Tourism
        (r"\b(tour|tours|tourist|travel|tourism|hotel|hotels|resort|adventure tours|retreats)\b", "travel-tourism", 0.9),

        # Automotive & Transportation
        (r"\b(automobile|automobiles|car repair|garage|auto parts|mechanic|rental car|wheels)\b", "automotive-transportation-services", 0.85),

        # Real Estate & Venues
        (r"\b(farmhouse|farm house|beach hut|real estate|event venue|maisons)\b", "real-estate-venues-rentals", 0.85),

        # Entertainment
        (r"\b(gym|play area|sports|cinema|amusement park|swimming pool|fitness center)\b", "entertainment-recreation", 0.85),

        # Schools / Education
        (r"\b(school|schools|montessori|preschool)\b", "schools-pre-schools", 0.9),
        (r"\b(college|colleges|university|universities|coaching|institute|institutes)\b", "colleges-universities-institutes", 0.9)
    ]

    matched_reasons = []

    for pattern, target_key, weight in semantic_patterns:
        match = re.search(pattern, text_to_check, re.IGNORECASE)
        if match:
            matched_str = match.group(0)
            key_scores[target_key] = key_scores.get(target_key, 0.0) + weight
            matched_reasons.append(f"matched '{matched_str}' in metadata/description")

    if not key_scores:
        best_key = "e-commerce-online-stores" if "store" in text_to_check else "restaurants-cafes"
        score = 0.5
        flagged = True
        reasoning = f"Generic description analyzed ('{desc[:60]}...'); assigned fallback taxonomy key."
    else:
        sorted_keys = sorted(key_scores.items(), key=lambda x: x[1], reverse=True)
        best_key, top_score = sorted_keys[0]
        score = min(round(top_score, 2), 0.98)
        flagged = False
        reasons_text = ", ".join(matched_reasons[:3])
        reasoning = f"Analyzed listing description & name: {reasons_text}."

    cat_name, subcat_name, pair_id = TAXONOMY_MAP[best_key]

    secondary_pairs = []
    all_pair_scores = {}
    for k, v in key_scores.items():
        c_name, sc_name, _ = TAXONOMY_MAP[k]
        pair_str = f"{c_name} -> {sc_name}"
        norm_score = min(round(v, 2), 0.98)
        all_pair_scores[pair_str] = norm_score
        if k != best_key and norm_score >= 0.4:
            secondary_pairs.append(pair_str)

    return {
        "id": row.get("id", ""),
        "name": name,
        "primary_pair_id": pair_id,
        "primary_category": cat_name,
        "primary_subcategory": subcat_name,
        "primary_relevance_score": score,
        "flagged": flagged,
        "secondary_pairs": ", ".join(secondary_pairs),
        "all_pair_scores_json": json.dumps(all_pair_scores),
        "reasoning": reasoning
    }

def main():
    print(f"Reading first 100 rows from {INPUT_CSV}...")
    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [next(reader) for _ in range(100)]

    classified_results = []
    for i, row in enumerate(rows, 1):
        classified = classify_row(row)
        classified_results.append(classified)
        if i <= 10 or i % 25 == 0:
            print(f"[{i}/100] Classified '{classified['name'][:30]}' -> {classified['primary_category']} / {classified['primary_subcategory']} ({classified['reasoning'][:60]})")

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

    fieldnames = [
        "id", "name", "primary_pair_id", "primary_category", 
        "primary_subcategory", "primary_relevance_score", "flagged", 
        "secondary_pairs", "all_pair_scores_json", "reasoning"
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(classified_results)

    print(f"\nDone! Exported 100 listings with deep description analysis to: {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
