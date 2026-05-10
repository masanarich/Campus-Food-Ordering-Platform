#SA Data Integration - Dietary and Allergen Standardisation

To standardise dietary and allergen information across all vendors, the platform uses a predefined dietary and allergen labels based on publicly available food metadat from **OpenFoodFacts**.

**OpenFoodFacts** is an internationally recognised open food database that provides structured information about ingredients, allergens, and dietary classfications  for food items.
The system currently supports the following standardised labels:

##Dietary Labels
-Vegan
-Vegetarian
-Halal

##Allergen Labels
-Nuts
-Gluten
-Dairy

Dropdown-based selection are implemented in the vendor product management interface to ensure that vendors select from predefined standardised values rather than entering free-text labels.
This approach improves:
-consistency across vendors
-food transparency for students
-allergy awareness and safety
-filtering and searching of products
-database consistency and scalability
The use of predefined labels also prevents spelling inconsistencies.
