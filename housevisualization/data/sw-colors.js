// Curated Sherwin-Williams exterior palette.
// Hex values are best-effort sRGB approximations of SW's published color data.
// They're close enough to evaluate schemes, but order real paint chips before
// committing to a finish.
window.SW_COLORS = [
  // Warm Whites & Creams
  { code: "SW 7006", name: "Extra White",       hex: "#F0EFEA", group: "Warm Whites & Creams" },
  { code: "SW 7005", name: "Pure White",        hex: "#EDEDE6", group: "Warm Whites & Creams" },
  { code: "SW 7008", name: "Alabaster",         hex: "#EDEAE0", group: "Warm Whites & Creams" },
  { code: "SW 7004", name: "Snowbound",         hex: "#E7E5DE", group: "Warm Whites & Creams" },
  { code: "SW 7551", name: "Greek Villa",       hex: "#EBE3D0", group: "Warm Whites & Creams" },
  { code: "SW 7012", name: "Creamy",            hex: "#EDE4CD", group: "Warm Whites & Creams" },
  { code: "SW 7011", name: "Natural Choice",    hex: "#E0D6C2", group: "Warm Whites & Creams" },
  { code: "SW 7042", name: "Shoji White",       hex: "#DFD7C7", group: "Warm Whites & Creams" },
  { code: "SW 7010", name: "White Duck",        hex: "#D9D2BF", group: "Warm Whites & Creams" },

  // Beiges & Greiges
  { code: "SW 7036", name: "Accessible Beige",  hex: "#D2C6B3", group: "Beiges & Greiges" },
  { code: "SW 7037", name: "Balanced Beige",    hex: "#C3B39E", group: "Beiges & Greiges" },
  { code: "SW 7029", name: "Agreeable Gray",    hex: "#D1CBBD", group: "Beiges & Greiges" },
  { code: "SW 7043", name: "Worldly Gray",      hex: "#C3BAAA", group: "Beiges & Greiges" },
  { code: "SW 7031", name: "Mega Greige",       hex: "#B3A798", group: "Beiges & Greiges" },
  { code: "SW 6073", name: "Perfect Greige",    hex: "#B8ADA0", group: "Beiges & Greiges" },
  { code: "SW 7050", name: "Useful Gray",       hex: "#C7BFB2", group: "Beiges & Greiges" },
  { code: "SW 7032", name: "Warm Stone",        hex: "#A3957E", group: "Beiges & Greiges" },
  { code: "SW 7023", name: "Requisite Gray",    hex: "#A9A396", group: "Beiges & Greiges" },
  { code: "SW 7038", name: "Tony Taupe",        hex: "#988976", group: "Beiges & Greiges" },
  { code: "SW 6039", name: "Poised Taupe",      hex: "#988479", group: "Beiges & Greiges" },
  { code: "SW 9172", name: "Studio Taupe",      hex: "#8D8175", group: "Beiges & Greiges" },
  { code: "SW 7507", name: "Stone Lion",        hex: "#B5A98F", group: "Beiges & Greiges" },
  { code: "SW 0077", name: "Classic French Gray", hex: "#8A8574", group: "Beiges & Greiges" },

  // Browns & Tans
  { code: "SW 6108", name: "Latte",             hex: "#B1987F", group: "Browns & Tans" },
  { code: "SW 6109", name: "Hopsack",           hex: "#B8A58C", group: "Browns & Tans" },
  { code: "SW 2822", name: "Downing Sand",      hex: "#C5AD8D", group: "Browns & Tans" },
  { code: "SW 7701", name: "Cavern Clay",       hex: "#B98164", group: "Browns & Tans" },
  { code: "SW 6054", name: "Canyon Clay",       hex: "#A58262", group: "Browns & Tans" },
  { code: "SW 9173", name: "Shiitake",          hex: "#968879", group: "Browns & Tans" },
  { code: "SW 6094", name: "Rustic Taupe",      hex: "#8A7A6A", group: "Browns & Tans" },
  { code: "SW 2821", name: "Downing Stone",     hex: "#968472", group: "Browns & Tans" },
  { code: "SW 2819", name: "Downing Earth",     hex: "#7A665A", group: "Browns & Tans" },
  { code: "SW 7041", name: "Van Dyke Brown",    hex: "#5C5245", group: "Browns & Tans" },
  { code: "SW 7595", name: "Sommelier",         hex: "#5A4B3E", group: "Browns & Tans" },

  // Greens
  { code: "SW 9130", name: "Evergreen Fog",     hex: "#95998C", group: "Greens" },
  { code: "SW 6206", name: "Oyster Bay",        hex: "#96A097", group: "Greens" },
  { code: "SW 6204", name: "Sea Salt",          hex: "#CBD4C6", group: "Greens" },
  { code: "SW 6212", name: "Quietude",          hex: "#B5C2B9", group: "Greens" },
  { code: "SW 6164", name: "Svelte Sage",       hex: "#ADAE91", group: "Greens" },
  { code: "SW 6178", name: "Clary Sage",        hex: "#A4A989", group: "Greens" },
  { code: "SW 6191", name: "Contented",         hex: "#C5C7A6", group: "Greens" },
  { code: "SW 6186", name: "Dried Thyme",       hex: "#7A7862", group: "Greens" },
  { code: "SW 9132", name: "Acacia Haze",       hex: "#7B8276", group: "Greens" },
  { code: "SW 6207", name: "Retreat",           hex: "#687565", group: "Greens" },
  { code: "SW 6187", name: "Rosemary",          hex: "#566B55", group: "Greens" },
  { code: "SW 6208", name: "Pewter Green",      hex: "#565C4E", group: "Greens" },
  { code: "SW 2847", name: "Roycroft Bottle Green", hex: "#415041", group: "Greens" },
  { code: "SW 2816", name: "Rookwood Dark Green", hex: "#4B5541", group: "Greens" },

  // Blues & Slates
  { code: "SW 6219", name: "Rain",              hex: "#ACBAC4", group: "Blues & Slates" },
  { code: "SW 6505", name: "Atmospheric",       hex: "#BDC9CE", group: "Blues & Slates" },
  { code: "SW 6470", name: "Waterscape",        hex: "#AFC4BE", group: "Blues & Slates" },
  { code: "SW 6243", name: "Distance",          hex: "#566976", group: "Blues & Slates" },
  { code: "SW 6222", name: "Riverway",          hex: "#536973", group: "Blues & Slates" },
  { code: "SW 0032", name: "Needlepoint Navy",  hex: "#324963", group: "Blues & Slates" },
  { code: "SW 6244", name: "Naval",             hex: "#2F3E52", group: "Blues & Slates" },
  { code: "SW 7602", name: "Indigo Batik",      hex: "#3C4858", group: "Blues & Slates" },
  { code: "SW 0068", name: "Copen Blue",        hex: "#6E94AF", group: "Blues & Slates" },
  { code: "SW 7964", name: "Cyberspace",        hex: "#4E5457", group: "Blues & Slates" },

  // Grays
  { code: "SW 7015", name: "Repose Gray",       hex: "#CCC7BA", group: "Grays" },
  { code: "SW 7016", name: "Mindful Gray",      hex: "#BCB6A8", group: "Grays" },
  { code: "SW 7017", name: "Dorian Gray",       hex: "#A39E92", group: "Grays" },
  { code: "SW 7046", name: "Anonymous",         hex: "#8B8174", group: "Grays" },
  { code: "SW 7073", name: "Network Gray",      hex: "#A29D93", group: "Grays" },
  { code: "SW 7504", name: "Keystone Gray",     hex: "#A59D8D", group: "Grays" },
  { code: "SW 7653", name: "Silverpointe",      hex: "#B2B1A5", group: "Grays" },
  { code: "SW 7064", name: "Passive",           hex: "#BDBDBB", group: "Grays" },
  { code: "SW 7066", name: "Gray Matters",      hex: "#ACA9A0", group: "Grays" },
  { code: "SW 7018", name: "Dovetail",          hex: "#888580", group: "Grays" },
  { code: "SW 7068", name: "Grizzle Gray",      hex: "#6F7470", group: "Grays" },
  { code: "SW 7019", name: "Gauntlet Gray",     hex: "#706D63", group: "Grays" },
  { code: "SW 7074", name: "Software",          hex: "#6C6A66", group: "Grays" },
  { code: "SW 7067", name: "Cityscape",         hex: "#A8A49D", group: "Grays" },
  { code: "SW 7065", name: "Argos",             hex: "#BCB9AE", group: "Grays" },

  // Charcoals & Blacks
  { code: "SW 7674", name: "Peppercorn",        hex: "#5E5B53", group: "Charcoals & Blacks" },
  { code: "SW 7048", name: "Urbane Bronze",     hex: "#56524A", group: "Charcoals & Blacks" },
  { code: "SW 7069", name: "Iron Ore",          hex: "#4C4A47", group: "Charcoals & Blacks" },
  { code: "SW 7020", name: "Black Fox",         hex: "#454039", group: "Charcoals & Blacks" },
  { code: "SW 6258", name: "Tricorn Black",     hex: "#2F2F30", group: "Charcoals & Blacks" },
  { code: "SW 6991", name: "Black Magic",       hex: "#282724", group: "Charcoals & Blacks" },
  { code: "SW 6990", name: "Caviar",            hex: "#2C2A27", group: "Charcoals & Blacks" },
  { code: "SW 6992", name: "Inkwell",           hex: "#302F2D", group: "Charcoals & Blacks" },

  // Accent / Door
  { code: "SW 6868", name: "Real Red",          hex: "#B73534", group: "Accent / Door" },
  { code: "SW 0033", name: "Rembrandt Ruby",    hex: "#8F3E3B", group: "Accent / Door" },
  { code: "SW 2802", name: "Rookwood Red",      hex: "#7B3636", group: "Accent / Door" },
  { code: "SW 7675", name: "Sealskin",          hex: "#3F3A38", group: "Accent / Door" },
  { code: "SW 6171", name: "Chatroom",          hex: "#A39483", group: "Accent / Door" },
];

window.SW_GROUPS = [
  "Warm Whites & Creams",
  "Beiges & Greiges",
  "Browns & Tans",
  "Grays",
  "Greens",
  "Blues & Slates",
  "Charcoals & Blacks",
  "Accent / Door",
];
