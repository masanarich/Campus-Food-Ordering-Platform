# SA Data Integration for Dietary and Allergen Standardisation

## Requirement Overview

The project requires that menu items include dietary and allergen information such as halal, vegan, vegetarian, nut-free, gluten-related, and dairy-related indicators. In addition, the requirement specifies that the team must research and identify a publicly available South African or internationally recognised dietary/allergen data source and document the chosen source together with the justification for selecting it.

To satisfy this requirement, the team researched available food metadata platforms and selected **OpenFoodFacts** as the preferred source for dietary and allergen standardisation within the Campus Food Ordering Platform.

---

## Documented Data Source

### Selected Source
- **Name:** OpenFoodFacts
- **Website:** https://world.openfoodfacts.org
- **Type:** International open food product database

OpenFoodFacts is a publicly available and internationally recognised food database that stores structured food-related metadata collected from multiple countries. The platform contains information about food ingredients, allergens, dietary classifications, nutrition values, and food categories.

The database is widely used and continuously maintained by contributors worldwide, making it a reliable source for food classification and allergen information.

---

## Justification for Selecting OpenFoodFacts

The team selected OpenFoodFacts because it provides structured and standardised dietary and allergen metadata that can be consistently applied across all vendors using the Campus Food Ordering Platform.

One of the major challenges in multi-vendor food systems is inconsistency in how vendors describe dietary and allergen information. Vendors may use different wording, abbreviations, spellings, or naming conventions for the same dietary category. For example, one vendor may use the term “gluten free,” another may use “GF,” while another may not provide allergen information at all. This creates inconsistency within the system and may negatively affect students who rely on accurate food information when placing orders.

By using OpenFoodFacts as the reference source, the platform standardises dietary and allergen labels so that all vendors use the same predefined classifications. This improves consistency and ensures that students receive clearer and more reliable food information.

The team specifically chose OpenFoodFacts because:
- it is publicly available and accessible
- it is internationally recognised
- it contains structured allergen and dietary metadata
- it supports food transparency and allergy awareness
- it improves consistency across vendor menu items
- it supports future scalability and maintainability of the platform

---

## Implementation Within the System

The Campus Food Ordering Platform currently supports predefined dietary and allergen labels derived from the selected data source.

### Dietary Labels
- Vegan
- Vegetarian
- Halal

### Allergen Labels
- Nuts
- Gluten
- Dairy

To maintain consistency, vendors do not manually type dietary or allergen values. Instead, the product management interface uses predefined dropdown selection fields that allow vendors to choose standardised values only.

This implementation approach:
- prevents spelling inconsistencies
- improves database consistency
- improves product filtering and searching
- increases food transparency for students
- improves allergy awareness and safety

---

## Conclusion

The team selected OpenFoodFacts as the official dietary and allergen data source for the Campus Food Ordering Platform because it provides reliable, structured, and internationally recognised food metadata that supports standardised dietary and allergen classification across all vendors.

Documenting and integrating this data source within the project backlog demonstrates how the system satisfies the SA Data Integration requirement while improving consistency, scalability, food transparency, and student safety across the platform.
