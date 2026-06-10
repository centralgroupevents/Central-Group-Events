// Town → North/Central/South NJ mapping for watch party grouping.
//
// Covers the most populous and commonly-used NJ towns. Towns not in this map
// fall through to "Other" — admins can add them as needed. Matching is case-
// and whitespace-insensitive; "Jersey City", "jersey city", " JERSEY CITY "
// all resolve to the same entry.

export type NjRegion = "North NJ" | "Central NJ" | "South NJ";

const NORTH = new Set<string>([
  // Bergen
  "hackensack","englewood","teaneck","fort lee","edgewater","cliffside park","ridgewood",
  "garfield","lyndhurst","ridgefield","palisades park","leonia","fairview","north arlington",
  "secaucus","maywood","rochelle park","saddle brook","lodi","hasbrouck heights","moonachie",
  "elmwood park","fair lawn","paramus","mahwah","ramsey","tenafly","cresskill","new milford",
  "river edge","oradell","westwood","emerson","hillsdale","dumont","bergenfield","wyckoff",
  "wood-ridge","wallington","carlstadt","east rutherford","rutherford","north bergen",
  "little ferry","franklin lakes","glen rock","midland park","midland","waldwick","saddle river",
  // Essex
  "newark","east orange","west orange","orange","irvington","montclair","bloomfield","belleville",
  "nutley","caldwell","verona","cedar grove","glen ridge","maplewood","south orange","livingston",
  "millburn","short hills","essex fells","north caldwell","fairfield","roseland","west caldwell",
  // Hudson
  "jersey city","hoboken","bayonne","weehawken","union city","west new york","kearny","harrison",
  "east newark","guttenberg",
  // Morris
  "morristown","parsippany","morris plains","madison","chatham","summit","florham park","denville",
  "rockaway","dover","randolph","mendham","chester","mount olive","mount arlington","jefferson",
  "boonton","montville","whippany","east hanover","west caldwell","pequannock",
  // Passaic
  "paterson","clifton","passaic","wayne","west milford","ringwood","pompton lakes","totowa","woodland park",
  "haledon","north haledon","prospect park","little falls","west paterson","bloomingdale","hawthorne",
  // Sussex
  "newton","sparta","vernon","franklin","hardyston","hopatcong","stanhope","byram",
  // Union
  "elizabeth","linden","union","roselle","roselle park","plainfield","westfield","cranford","summit",
  "berkeley heights","new providence","mountainside","springfield","scotch plains","kenilworth",
  "rahway","clark","fanwood","garwood","hillside","winfield","union township",
  // Warren
  "phillipsburg","washington","hackettstown","belvidere","blairstown","mansfield","independence",
]);

const CENTRAL = new Set<string>([
  // Hunterdon
  "flemington","clinton","lambertville","frenchtown","high bridge","milford","raritan township",
  // Mercer
  "trenton","princeton","hamilton","robbinsville","east windsor","hightstown","hopewell","lawrence",
  "lawrenceville","pennington","ewing","west windsor","cranbury",
  // Middlesex
  "new brunswick","edison","woodbridge","perth amboy","carteret","south amboy","sayreville",
  "east brunswick","north brunswick","south brunswick","piscataway","highland park","old bridge",
  "metuchen","milltown","spotswood","monroe","monroe township","cranbury","jamesburg","helmetta",
  "south plainfield","middlesex","dunellen","plainsboro","south river","colonia","iselin","avenel",
  // Monmouth
  "asbury park","bradley beach","belmar","spring lake","long branch","red bank","middletown",
  "holmdel","manalapan","marlboro","freehold","howell","wall","ocean township","aberdeen","matawan",
  "keansburg","keyport","atlantic highlands","highlands","rumson","fair haven","tinton falls",
  "shrewsbury","eatontown","oceanport","west long branch","monmouth beach","sea bright","allenhurst",
  "ocean grove","neptune","avon-by-the-sea","sea girt","manasquan","brielle","point pleasant",
  "lake como","colts neck","englishtown","farmingdale","millstone",
  // Ocean
  "brick","toms river","lakewood","manchester","berkeley","lacey","barnegat","stafford","tuckerton",
  "long beach","beach haven","seaside heights","seaside park","lavallette","mantoloking","bay head",
  "point pleasant beach","jackson","plumsted","whiting","silver ridge","ocean gate","island heights",
  "pine beach","beachwood","south toms river","little egg harbor","barnegat light","ship bottom",
  "surf city","harvey cedars","long beach township","eagleswood","ocean township",
  // Somerset
  "somerville","bridgewater","hillsborough","montgomery","franklin","bound brook","manville",
  "north plainfield","raritan","bernards","bernardsville","basking ridge","bedminster","peapack",
  "gladstone","far hills","watchung","green brook","warren","middlesex","branchburg","rocky hill",
]);

const SOUTH = new Set<string>([
  // Atlantic
  "atlantic city","pleasantville","absecon","brigantine","margate","margate city","ventnor",
  "ventnor city","longport","ocean city","linwood","northfield","somers point","galloway",
  "egg harbor","egg harbor township","egg harbor city","hammonton","mullica","hamilton township",
  "estell manor","corbin city","weymouth","port republic","folsom","buena","buena vista",
  // Burlington
  "burlington","mount laurel","mount holly","moorestown","willingboro","pemberton","medford",
  "marlton","evesham","cinnaminson","delran","riverside","palmyra","beverly","edgewater park",
  "lumberton","westampton","eastampton","southampton","tabernacle","shamong","woodland",
  "new hanover","north hanover","springfield","wrightstown","cookstown","fort dix","mcguire afb",
  "bordentown","fieldsboro","mansfield","florence","columbus","chesterfield","crosswicks",
  // Camden
  "camden","cherry hill","voorhees","haddonfield","haddon heights","collingswood","gloucester",
  "gloucester city","audubon","oaklyn","pennsauken","merchantville","westmont","barrington",
  "berlin","sicklerville","blackwood","clementon","laurel springs","lawnside","lindenwold",
  "magnolia","mount ephraim","pine hill","runnemede","somerdale","stratford","woodlynne",
  "winslow","atco","waterford",
  // Cape May
  "cape may","cape may court house","wildwood","wildwood crest","north wildwood","stone harbor",
  "avalon","sea isle city","ocean city","middle","middle township","upper","upper township",
  "lower","lower township","west cape may","west wildwood","woodbine","dennis","dennis township",
  // Cumberland
  "vineland","bridgeton","millville","commercial","downe","fairfield","greenwich","hopewell",
  "lawrence","maurice river","shiloh","stow creek","upper deerfield",
  // Gloucester
  "glassboro","pitman","woodbury","deptford","washington township","mantua","west deptford",
  "national park","westville","wenonah","paulsboro","mount royal","logan","greenwich",
  "harrison","clayton","franklin","monroe","newfield","south harrison","swedesboro","woolwich",
  "elk","logan","east greenwich","pittsgrove","upper pittsgrove",
  // Salem
  "salem","penns grove","carneys point","pennsville","quinton","alloway","elsinboro",
  "lower alloways creek","mannington","oldmans","upper pittsgrove","woodstown","pilesgrove",
]);

function normalize(town: string): string {
  return town.toLowerCase().trim()
    .replace(/\s*,\s*nj\s*$/i, "")  // strip ", NJ"
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
}

export function getRegionForTown(town: string | null | undefined): NjRegion | null {
  if (!town) return null;
  const n = normalize(town);
  if (NORTH.has(n)) return "North NJ";
  if (CENTRAL.has(n)) return "Central NJ";
  if (SOUTH.has(n)) return "South NJ";
  return null;
}

export const REGIONS: NjRegion[] = ["North NJ", "Central NJ", "South NJ"];
