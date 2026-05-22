(function attachSouthAfricanInstitutions(globalScope) {
    "use strict";

    const INSTITUTION_TYPES = Object.freeze({
        PUBLIC_UNIVERSITY: "Public University",
        TVET_COLLEGE: "TVET College",
        PRIVATE_COLLEGE: "Private College"
    });

    const SOUTH_AFRICAN_INSTITUTIONS = [
        {
            name: "University of the Witwatersrand",
            shortName: "Wits",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Gauteng",
            campuses: [
                "Braamfontein Campus East — Johannesburg",
                "Braamfontein Campus West — Johannesburg",
                "Education Campus — Parktown, Johannesburg",
                "Health Sciences Campus — Parktown, Johannesburg",
                "Parktown Management Campus — Parktown, Johannesburg",
                "Wits Donald Gordon Medical Centre — Parktown, Johannesburg",
                "Rural Campus — Mpumalanga"
            ]
        },
        {
            name: "University of Johannesburg",
            shortName: "UJ",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Gauteng",
            campuses: [
                "Auckland Park Kingsway Campus — Auckland Park, Johannesburg",
                "Auckland Park Bunting Road Campus — Auckland Park, Johannesburg",
                "Doornfontein Campus — Doornfontein, Johannesburg",
                "Soweto Campus — Soweto, Johannesburg"
            ]
        },
        {
            name: "University of Cape Town",
            shortName: "UCT",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Western Cape",
            campuses: [
                "Upper Campus — Rondebosch, Cape Town",
                "Middle Campus — Rondebosch, Cape Town",
                "Lower Campus — Rondebosch, Cape Town",
                "Health Sciences Campus — Observatory, Cape Town",
                "Hiddingh Campus — Gardens, Cape Town",
                "Breakwater Campus — V&A Waterfront, Cape Town"
            ]
        },
        {
            name: "Stellenbosch University",
            shortName: "Stellenbosch",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Western Cape",
            campuses: [
                "Stellenbosch Main Campus — Stellenbosch",
                "Tygerberg Campus — Bellville, Cape Town",
                "Bellville Park Campus — Bellville, Cape Town",
                "Saldanha Campus — Saldanha Bay",
                "Worcester Campus — Worcester"
            ]
        },
        {
            name: "University of Pretoria",
            shortName: "UP",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Gauteng",
            campuses: [
                "Hatfield Campus — Hatfield, Pretoria",
                "Hillcrest Campus — Pretoria",
                "Groenkloof Campus — Pretoria",
                "Prinshof Campus — Pretoria",
                "Onderstepoort Campus — Onderstepoort, Pretoria",
                "Mamelodi Campus — Mamelodi, Pretoria",
                "Gordon Institute of Business Science — Illovo, Johannesburg",
                "GIBS inner-city site — Johannesburg CBD"
            ]
        },
        {
            name: "University of KwaZulu-Natal",
            shortName: "UKZN",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "KwaZulu-Natal",
            campuses: [
                "Edgewood Campus — Pinetown",
                "Howard College Campus — Glenwood, Durban",
                "Nelson R. Mandela School of Medicine — Umbilo, Durban",
                "Pietermaritzburg Campus — Scottsville, Pietermaritzburg",
                "Westville Campus — Westville, Durban"
            ]
        },
        {
            name: "North-West University",
            shortName: "NWU",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "North West",
            campuses: [
                "Potchefstroom Campus — Potchefstroom",
                "Mahikeng Campus — Mahikeng",
                "Vanderbijlpark Campus — Vanderbijlpark"
            ]
        },
        {
            name: "University of the Free State",
            shortName: "UFS",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Free State",
            campuses: [
                "Bloemfontein Campus — Bloemfontein",
                "South Campus — Bloemfontein",
                "Qwaqwa Campus — Phuthaditjhaba"
            ]
        },
        {
            name: "Rhodes University",
            shortName: "Rhodes",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Eastern Cape",
            campuses: ["Main Campus — Makhanda"]
        },
        {
            name: "University of Fort Hare",
            shortName: "UFH",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Eastern Cape",
            campuses: [
                "Alice Campus — Alice",
                "East London Campus — East London",
                "Bhisho Campus — Bhisho"
            ]
        },
        {
            name: "University of the Western Cape",
            shortName: "UWC",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Western Cape",
            campuses: ["Main Campus — Bellville, Cape Town"]
        },
        {
            name: "University of Limpopo",
            shortName: "UL",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Limpopo",
            campuses: ["Turfloop Campus — Mankweng, Polokwane"]
        },
        {
            name: "University of Venda",
            shortName: "Univen",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Limpopo",
            campuses: ["Main Campus — Thohoyandou"]
        },
        {
            name: "University of South Africa",
            shortName: "UNISA",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Nationwide",
            campuses: [
                "Muckleneuk Campus — Pretoria",
                "Sunnyside Campus — Pretoria",
                "Science Campus — Florida, Roodepoort",
                "Regional centres — Nationwide"
            ]
        },
        {
            name: "Nelson Mandela University",
            shortName: "NMU",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Eastern Cape",
            campuses: [
                "South Campus — Summerstrand, Gqeberha",
                "North Campus — Summerstrand, Gqeberha",
                "Second Avenue Campus — Summerstrand, Gqeberha",
                "Missionvale Campus — Missionvale, Gqeberha",
                "Bird Street Campus — Central, Gqeberha",
                "Ocean Sciences Campus — Gqeberha",
                "George Campus — George"
            ]
        },
        {
            name: "Walter Sisulu University",
            shortName: "WSU",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Eastern Cape",
            campuses: [
                "Mthatha Campus — Mthatha",
                "Butterworth Campus — Butterworth",
                "Buffalo City Campus — East London",
                "Komani Campus — Komani"
            ]
        },
        {
            name: "University of Zululand",
            shortName: "UniZulu",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "KwaZulu-Natal",
            campuses: [
                "KwaDlangezwa Campus — Empangeni",
                "Richards Bay Campus — Richards Bay"
            ]
        },
        {
            name: "Sefako Makgatho Health Sciences University",
            shortName: "SMU",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Gauteng",
            campuses: ["Main Campus — Ga-Rankuwa, Pretoria"]
        },
        {
            name: "Sol Plaatje University",
            shortName: "SPU",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Northern Cape",
            campuses: [
                "Central Campus — Kimberley",
                "North Campus — Kimberley",
                "South Campus — Kimberley"
            ]
        },
        {
            name: "University of Mpumalanga",
            shortName: "UMP",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Mpumalanga",
            campuses: [
                "Mbombela Campus — Mbombela",
                "Siyabuswa Campus — Siyabuswa"
            ]
        },
        {
            name: "Cape Peninsula University of Technology",
            shortName: "CPUT",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Western Cape",
            campuses: [
                "Bellville Campus — Bellville, Cape Town",
                "District Six Campus — Cape Town CBD",
                "Mowbray Campus — Mowbray, Cape Town",
                "Granger Bay Campus — Cape Town",
                "Wellington Campus — Wellington",
                "Athlone Campus — Athlone, Cape Town"
            ]
        },
        {
            name: "Central University of Technology",
            shortName: "CUT",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Free State",
            campuses: [
                "Bloemfontein Campus — Bloemfontein",
                "Welkom Campus — Welkom"
            ]
        },
        {
            name: "Durban University of Technology",
            shortName: "DUT",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "KwaZulu-Natal",
            campuses: [
                "Steve Biko Campus — Durban",
                "ML Sultan Campus — Durban",
                "Ritson Campus — Durban",
                "City Campus — Durban CBD",
                "Brickfield Campus — Durban",
                "Indumiso Campus — Pietermaritzburg",
                "Riverside Campus — Pietermaritzburg"
            ]
        },
        {
            name: "Mangosuthu University of Technology",
            shortName: "MUT",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "KwaZulu-Natal",
            campuses: ["Main Campus — Umlazi, Durban"]
        },
        {
            name: "Tshwane University of Technology",
            shortName: "TUT",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Gauteng",
            campuses: [
                "Pretoria Campus — Pretoria",
                "Arcadia Campus — Pretoria",
                "Arts Campus — Pretoria",
                "Ga-Rankuwa Campus — Ga-Rankuwa",
                "Soshanguve North Campus — Soshanguve",
                "Soshanguve South Campus — Soshanguve",
                "eMalahleni Campus — eMalahleni",
                "Mbombela Campus — Mbombela",
                "Polokwane Campus — Polokwane"
            ]
        },
        {
            name: "Vaal University of Technology",
            shortName: "VUT",
            type: INSTITUTION_TYPES.PUBLIC_UNIVERSITY,
            province: "Gauteng",
            campuses: [
                "Vanderbijlpark Campus — Vanderbijlpark",
                "Ekurhuleni Campus — Kempton Park",
                "Secunda Campus — Secunda",
                "Upington Campus — Upington",
                "Klerksdorp delivery site — Klerksdorp"
            ]
        },

        // ---- TVET Colleges ----
        { name: "Central Johannesburg TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Johannesburg", "Parktown", "Alexandra", "Ellis Park", "Riverlea", "Crown Mines"] },
        { name: "Ekurhuleni East TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Springs", "Benoni", "Daveyton", "Kwa-Thema", "Brakpan"] },
        { name: "Ekurhuleni West TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Germiston", "Boksburg", "Alberton", "Kathorus", "Tembisa", "Kempton Park"] },
        { name: "Sedibeng TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Vereeniging", "Vanderbijlpark", "Sebokeng", "Heidelberg"] },
        { name: "South West Gauteng TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Soweto", "Roodepoort", "Randburg", "Molapo", "Dobsonville"] },
        { name: "Tshwane North TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Pretoria", "Soshanguve", "Mamelodi", "Temba"] },
        { name: "Tshwane South TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Pretoria West", "Atteridgeville", "Centurion", "Odi", "Mabopane"] },
        { name: "Western TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Gauteng",
            campuses: ["Randfontein", "Carletonville", "Krugersdorp", "Westonaria"] },
        { name: "Boland TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Western Cape",
            campuses: ["Stellenbosch", "Paarl", "Worcester", "Caledon", "Strand"] },
        { name: "College of Cape Town", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Western Cape",
            campuses: ["Cape Town CBD", "Athlone", "Crawford", "Gardens", "Gugulethu", "Pinelands", "Thornton", "Wynberg"] },
        { name: "False Bay TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Western Cape",
            campuses: ["Muizenberg", "Fish Hoek", "Khayelitsha", "Mitchells Plain", "Westlake"] },
        { name: "Northlink TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Western Cape",
            campuses: ["Bellville", "Parow", "Goodwood", "Tygerberg", "Wingfield", "Protea", "Belhar"] },
        { name: "South Cape TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Western Cape",
            campuses: ["George", "Mossel Bay", "Oudtshoorn", "Beaufort West", "Hessequa"] },
        { name: "West Coast TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Western Cape",
            campuses: ["Malmesbury", "Atlantis", "Vredenburg", "Citrusdal", "Vredendal"] },
        { name: "Coastal KZN TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Durban", "Umlazi", "Swinton", "Umbumbulu", "Appelsbosch"] },
        { name: "Elangeni TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Pinetown", "KwaMashu", "Inanda", "Hammarsdale", "Ntuzuma"] },
        { name: "Esayidi TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Port Shepstone", "Kokstad", "Umzimkhulu", "Gamalakhe"] },
        { name: "Majuba TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Newcastle", "Madadeni", "Dundee"] },
        { name: "Mnambithi TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Ladysmith", "Estcourt", "Ezakheni"] },
        { name: "Mthashana TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Vryheid", "Nongoma", "Ulundi", "Babanango"] },
        { name: "Thekwini TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Durban", "Asherville", "Springfield", "Melbourne", "Umbilo"] },
        { name: "Umfolozi TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Richards Bay", "Empangeni", "Esikhawini", "Eshowe", "Nkandla"] },
        { name: "Umgungundlovu TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "KwaZulu-Natal",
            campuses: ["Pietermaritzburg", "Edendale", "Msunduzi", "Midlands"] },
        { name: "Buffalo City TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["East London", "Mdantsane", "St Marks", "John Knox Bokwe"] },
        { name: "Eastcape Midlands TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["Kariega", "Gqeberha", "Makhanda"] },
        { name: "Ikhala TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["Komani", "Aliwal North", "Sterkspruit", "Ezibeleni"] },
        { name: "Ingwe TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["Mount Frere", "Lusikisiki", "Maluti", "Ngqungqushe", "Siteto"] },
        { name: "King Hintsa TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["Butterworth", "Teko", "Dutywa", "Centane", "Msobomvu"] },
        { name: "King Sabata Dalindyebo TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["Mthatha", "Libode", "Ngcobo", "Zimbane", "Mngazi"] },
        { name: "Lovedale TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["Alice", "Qonce", "Zwelitsha"] },
        { name: "Port Elizabeth TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Eastern Cape",
            campuses: ["Gqeberha", "Russell Road", "Dower", "Iqhayiya"] },
        { name: "Capricorn TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Limpopo",
            campuses: ["Polokwane", "Seshego", "Senwabarwana", "Ramokgopa"] },
        { name: "Lephalale TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Limpopo",
            campuses: ["Lephalale", "Modimolle"] },
        { name: "Letaba TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Limpopo",
            campuses: ["Tzaneen", "Maake", "Giyani"] },
        { name: "Mopani South East TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Limpopo",
            campuses: ["Phalaborwa", "Namakgale", "Sir Val Duncan"] },
        { name: "Sekhukhune TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Limpopo",
            campuses: ["Groblersdal", "CN Phatudi", "Apel"] },
        { name: "Vhembe TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Limpopo",
            campuses: ["Sibasa", "Makwarela", "Thengwe", "Mavhoi", "Mashamba"] },
        { name: "Waterberg TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Limpopo",
            campuses: ["Mokopane", "Mahwelereng", "Thabazimbi"] },
        { name: "Flavius Mareka TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Free State",
            campuses: ["Sasolburg", "Kroonstad", "Mphohadi"] },
        { name: "Goldfields TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Free State",
            campuses: ["Welkom", "Tosa", "Meloding"] },
        { name: "Maluti TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Free State",
            campuses: ["Phuthaditjhaba", "Bethlehem", "Kwetlisong", "Bonamelo", "Harrismith"] },
        { name: "Motheo TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Free State",
            campuses: ["Bloemfontein", "Botshabelo", "Thaba Nchu", "Hillside"] },
        { name: "Ehlanzeni TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Mpumalanga",
            campuses: ["Mbombela", "KaNyamazane", "Mlumati", "Barberton", "Mthimba"] },
        { name: "Gert Sibande TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Mpumalanga",
            campuses: ["Standerton", "Ermelo", "Evander", "Balfour", "Perdekop"] },
        { name: "Nkangala TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Mpumalanga",
            campuses: ["eMalahleni", "Middelburg", "CN Mahlangu", "Waterval Boven"] },
        { name: "Orbit TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "North West",
            campuses: ["Rustenburg", "Brits", "Mankwe"] },
        { name: "Taletso TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "North West",
            campuses: ["Mahikeng", "Lichtenburg", "Lehurutshe"] },
        { name: "Vuselela TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "North West",
            campuses: ["Klerksdorp", "Potchefstroom", "Taung", "Matlosana"] },
        { name: "Northern Cape Rural TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Northern Cape",
            campuses: ["Upington", "Kathu", "Kuruman", "Namaqualand", "De Aar"] },
        { name: "Northern Cape Urban TVET College", type: INSTITUTION_TYPES.TVET_COLLEGE, province: "Northern Cape",
            campuses: ["Kimberley", "Moremogolo", "City Campus", "Phatsimang"] },

        // ---- Private Colleges ----
        { name: "IIE Varsity College", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: [
                "Cape Town Campus — Cape Town",
                "Durban North Campus — Durban North",
                "Durban Westville Campus — Westville, Durban",
                "Sandton Campus — Sandton, Johannesburg",
                "Pretoria Campus — Pretoria",
                "Nelson Mandela Bay Campus — Gqeberha",
                "Waterfall Midrand Campus — Midrand",
                "Pietermaritzburg Campus — Pietermaritzburg",
                "Distance / Online — National"
            ] },
        { name: "IIE Rosebank College", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: [
                "Braamfontein Campus — Johannesburg",
                "Bloemfontein Campus — Bloemfontein",
                "Cape Town Campus — Cape Town",
                "Durban Campus — Durban",
                "Nelson Mandela Bay Campus — Gqeberha",
                "Mbombela Campus — Mbombela",
                "Pietermaritzburg Campus — Pietermaritzburg",
                "Pretoria CBD Campus — Pretoria",
                "Polokwane Campus — Polokwane"
            ] },
        { name: "Eduvos", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: [
                "Bedfordview Campus — Bedfordview",
                "Bloemfontein Campus — Bloemfontein",
                "Mowbray Campus — Cape Town",
                "Nelson Mandela Bay Campus — Gqeberha",
                "Potchefstroom Campus — Potchefstroom",
                "Pretoria Campus — Pretoria",
                "Tygervalley Campus — Bellville",
                "Midrand Campus — Midrand",
                "Mbombela Campus — Mbombela",
                "East London Campus — East London",
                "Durban Campus — Umhlanga, Durban",
                "Vanderbijlpark Campus — Vanderbijlpark",
                "Eduvos Online — National"
            ] },
        { name: "STADIO Higher Education", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: [
                "Centurion Campus — Centurion, Pretoria",
                "Hatfield Campus — Pretoria",
                "Waterfall Campus — Midrand",
                "Randburg Campus — Johannesburg",
                "Krugersdorp Campus — Krugersdorp",
                "Musgrave Campus — Durban",
                "Bellville Campus — Cape Town",
                "Durbanville Campus — Cape Town"
            ] },
        { name: "Vega School", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: [
                "Johannesburg Campus — Sandton",
                "Cape Town Campus — Cape Town",
                "Durban Campus — Durban",
                "Pretoria Campus — Pretoria"
            ] },
        { name: "Boston City Campus", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: [
                "Johannesburg — Head office",
                "Pretoria support centre",
                "Durban support centre",
                "Cape Town support centre",
                "Bloemfontein support centre",
                "Gqeberha support centre",
                "Polokwane support centre",
                "Mbombela support centre",
                "East London support centre"
            ] },
        { name: "MANCOSA", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Durban", "Johannesburg", "Cape Town", "Pretoria", "Online — National"] },
        { name: "Regent Business School", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Durban", "Johannesburg", "Cape Town", "Pretoria", "Online — National"] },
        { name: "Milpark Education", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Melville, Johannesburg", "Cape Town", "Online — National"] },
        { name: "AFDA", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Johannesburg Campus", "Cape Town Campus", "Durban Campus", "Gqeberha Campus"] },
        { name: "IMM Graduate School", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Johannesburg", "Durban", "Cape Town", "Pretoria", "Online — National"] },
        { name: "Richfield Graduate Institute of Technology", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Johannesburg", "Pretoria", "Durban", "Cape Town", "Polokwane", "Mbombela", "East London"] },
        { name: "Damelin", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Braamfontein, Johannesburg", "Randburg", "Pretoria", "Durban", "Cape Town", "Gqeberha", "Bloemfontein"] },
        { name: "CTU Training Solutions", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Pretoria", "Roodepoort", "Boksburg", "Bloemfontein", "Cape Town", "Durban", "Gqeberha", "Potchefstroom", "Polokwane", "Stellenbosch", "Vereeniging", "Online"] },
        { name: "Belgium Campus iTversity", type: INSTITUTION_TYPES.PRIVATE_COLLEGE,
            campuses: ["Pretoria Campus", "Kempton Park Campus", "Stellenbosch Campus", "Online"] }
    ];

    function normalizeLowerText(value) {
        return typeof value === "string" ? value.trim().toLowerCase() : "";
    }

    function getAllInstitutions() {
        return SOUTH_AFRICAN_INSTITUTIONS.slice();
    }

    function findInstitutionByName(name) {
        const needle = normalizeLowerText(name);

        if (!needle) {
            return null;
        }

        return (
            SOUTH_AFRICAN_INSTITUTIONS.find(function matchName(entry) {
                return normalizeLowerText(entry.name) === needle ||
                    normalizeLowerText(entry.shortName) === needle;
            }) || null
        );
    }

    function getCampusesFor(institutionName) {
        const found = findInstitutionByName(institutionName);
        return found ? found.campuses.slice() : [];
    }

    function getInstitutionsByType(type) {
        return SOUTH_AFRICAN_INSTITUTIONS.filter(function matchType(entry) {
            return entry.type === type;
        });
    }

    function groupInstitutionsByType() {
        return {
            publicUniversities: getInstitutionsByType(INSTITUTION_TYPES.PUBLIC_UNIVERSITY),
            tvetColleges: getInstitutionsByType(INSTITUTION_TYPES.TVET_COLLEGE),
            privateColleges: getInstitutionsByType(INSTITUTION_TYPES.PRIVATE_COLLEGE)
        };
    }

    const southAfricanInstitutions = {
        INSTITUTION_TYPES,
        SOUTH_AFRICAN_INSTITUTIONS,
        getAllInstitutions,
        findInstitutionByName,
        getCampusesFor,
        getInstitutionsByType,
        groupInstitutionsByType
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = southAfricanInstitutions;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.southAfricanInstitutions = southAfricanInstitutions;
    }
})(typeof window !== "undefined" ? window : globalThis);
