import type { Prompt } from './types';
// Original, bundled content. Each line is a distinct question, never a network dependency.
const favorites = `My ideal breakfast?|Pancakes|Idli|Toast|Fruit
My comfort drink?|Tea|Coffee|Cocoa|Lemonade
My favorite rainy-day sound?|Thunder|Roof drops|Leaves|Quiet
My first pick at a bakery?|Croissant|Brownie|Donut|Bread
My preferred movie snack?|Popcorn|Chips|Chocolate|Nothing
My favorite beach activity?|Swimming|Walking|Reading|Sandcastles
My ideal picnic spot?|Lake|Park|Hill|Garden
My favorite dessert texture?|Creamy|Crunchy|Chewy|Fluffy
My preferred breakfast pace?|Early and slow|Grab and go|Late brunch|Skip it
My favorite kind of view?|Mountains|Ocean|Skyline|Forest
My favorite room lighting?|Sunlight|Warm lamps|Fairy lights|Candles
My favorite date weather?|Cool breeze|Warm sunshine|Light rain|Snowy
My favorite flower style?|Wildflowers|Roses|Sunflowers|Orchids
My favorite way to hear music?|Headphones|Live concert|Car speakers|Vinyl
My favorite board-game mood?|Strategic|Silly|Cooperative|Fast
My favorite pizza topping?|Mushrooms|Extra cheese|Peppers|Olives
My favorite soup mood?|Spicy|Creamy|Brothy|Tangy
My favorite weekend outfit?|Pajamas|Jeans|Sportswear|Dressy
My favorite travel seat?|Window|Aisle|Front|Any
My favorite ice-cream style?|Cone|Cup|Sundae|Sandwich
My favorite museum type?|Art|Science|History|Transport
My favorite celebration food?|Cake|Biryani|Pizza|Homemade meal
My preferred sunrise location?|Beach|Rooftop|Hilltop|Bed
My favorite season feeling?|Spring blooms|Summer warmth|Autumn breeze|Winter blankets
My favorite stationery item?|Notebook|Pen|Stickers|Highlighter
My favorite sweet flavor?|Chocolate|Vanilla|Caramel|Fruit
My preferred restaurant table?|Window|Outside|Quiet corner|Near music
My favorite walking time?|Dawn|Afternoon|Sunset|Night
My favorite game-night prize?|Bragging rights|Dessert|Massage|Next date pick
My favorite cozy fabric?|Cotton|Wool|Fleece|Linen
My favorite plant style?|Flowers|Succulents|Leafy|Herbs
My favorite sandwich texture?|Toasted|Soft|Crusty|Grilled
My favorite comedy type?|Wordplay|Absurd|Observational|Slapstick
My favorite notebook pages?|Lined|Dotted|Blank|Squared
My favorite celebration size?|Just us|Close friends|Family|Big party
My favorite pool activity?|Laps|Floating|Water games|Sitting nearby
My favorite candle scent?|Citrus|Vanilla|Wood|Floral
My favorite meal temperature?|Piping hot|Warm|Room temperature|Cold
My favorite art medium?|Watercolor|Photography|Clay|Digital
My favorite kind of market?|Books|Food|Flowers|Antiques
My favorite vacation pace?|Packed plans|One outing a day|No plans|Mix it up
My favorite musical instrument sound?|Piano|Guitar|Violin|Drums
My favorite park feature?|Pond|Big trees|Walking trail|Playground
My favorite fries style?|Thin|Thick|Curly|Sweet potato
My favorite movie ending?|Happy|Bittersweet|Open-ended|Surprise
My favorite kind of gift?|Useful|Handmade|Experience|Surprise
My favorite toast topping?|Butter|Jam|Peanut butter|Avocado
My favorite street-food flavor?|Spicy|Sweet|Tangy|Savory
My favorite quiet activity?|Reading|Drawing|Puzzles|Gardening
My favorite way to relax together?|Talk|Cuddle|Cook|Watch something`;
const memories = `What do I remember most about our first meeting?|Your smile|Our conversation|The place|My nerves
What would I save from an old holiday?|Photos|Tickets|A souvenir|A journal
Which school memory do I talk about most?|Friends|Teachers|Trips|Competitions
What did I collect as a child?|Stickers|Stones|Cards|Nothing
How did I spend school breaks?|Playing outside|Reading|Watching TV|Visiting family
Which childhood treat feels nostalgic?|Ice cream|Candy|Cake|Street snacks
What did I enjoy making as a child?|Drawings|Stories|Models|Music
What did I usually do on long car rides?|Sleep|Sing|Look outside|Ask questions
Which early hobby would I revisit?|Dancing|Drawing|Sports|Crafts
What made birthdays special growing up?|Cake|Friends|Presents|Family meal
Which old photo would I frame?|Family|Friends|Travel|Us
What kind of childhood games did I prefer?|Pretend play|Sports|Puzzles|Video games
What do I remember about my first job or project?|People|Challenge|Payoff|Mistakes
What did I save pocket money for?|Books|Snacks|Toys|Trips
Which family tradition means most to me?|Shared meals|Festivals|Trips|Storytelling
Which first-date detail would I recreate?|Food|Location|Music|Conversation
What was my childhood bedtime habit?|Story|Music|Nightlight|Talking
What did I fear most as a child?|Dark|Insects|Heights|Getting lost
What kind of school assignment did I enjoy?|Essay|Experiment|Art|Presentation
How did I decorate my childhood room?|Posters|Drawings|Photos|Bare walls
What was my childhood role in group games?|Leader|Planner|Joker|Quiet player
Which trip souvenir do I value?|Photo|Local craft|Food memory|Postcard
What would I put in a memory box?|Letters|Photos|Tickets|Tiny gifts
How do I remember old conversations?|Exact words|Feeling|Place|Funny detail
Which growing-up skill felt hardest?|Cycling|Swimming|Speaking up|Cooking
What did I love at a fair?|Rides|Food|Games|Lights
Which childhood outing felt magical?|Zoo|Beach|Cinema|Train ride
What do I miss most about school?|Friends|Routine|Clubs|Holidays
Which old entertainment would I revisit?|Cartoons|Songs|Games|Comics
What first impressed me about you?|Kindness|Humor|Confidence|Curiosity
What makes an ordinary day memorable to me?|A laugh|A surprise|A deep talk|A new place
Which childhood weather memory stands out?|Rain puddles|Summer heat|Winter mornings|Storms
What did I bring to a sleepover?|Snacks|Games|Favorite pillow|Stories
How did I mark achievements growing up?|A treat|A photo|A celebration|Quiet pride
Which family recipe would I preserve?|Breakfast|Festival sweet|Comfort dinner|Snack
What did I like most about libraries?|Quiet|Stories|Discoveries|The smell
What do I notice first in an old video?|Voices|Expressions|Background|Clothes
Which memory would I write down first?|Our first hello|A trip|A kind gesture|A silly mistake
What kind of childhood toy did I love?|Building blocks|Soft toys|Vehicles|Art supplies
How did I spend a power cut as a child?|Stories|Games|Outside|Sleep
What childhood place would I show you?|School|Old home|Playground|Favorite shop
Which early success mattered most?|Learning a skill|Making a friend|Winning something|Helping someone
What made family journeys fun?|Songs|Snacks|Stops|Conversations
What do I remember about a favorite teacher?|Encouragement|Humor|Lessons|Stories
What did I doodle in notebook margins?|Faces|Patterns|Flowers|Words
What sort of keepsake do I lose least?|Letters|Jewelry|Photos|Books
What do I miss about a former home?|People|Room|Neighborhood|Routine
How would I retell a shared mishap?|Dramatically|Briefly|With laughter|With a lesson
Which childhood celebration detail stays with me?|Decorations|Food|Outfits|People
What would I most like to record about us?|Everyday moments|Trips|Conversations|Milestones`;
const habits = `What do I do first after waking?|Check phone|Drink water|Stretch|Stay in bed
How do I choose a restaurant?|Reviews|Menu|Atmosphere|Spontaneously
How do I handle an unread message?|Reply now|Save for later|Draft reply|Forget briefly
How do I pack for a trip?|List|Last minute|Overpack|Minimal
What do I do while waiting?|Read|Scroll|People-watch|Daydream
How do I prefer to plan a week?|Calendar|List|Mental notes|One day at a time
How do I react to a surprise?|Smile|Ask questions|Get quiet|Laugh
What do I do when stressed?|Talk|Walk|Clean|Rest
How do I learn a new skill?|Watch|Read|Try|Ask someone
How do I choose a movie?|Trailer|Reviews|Cast|Your pick
What is my cooking style?|Follow recipe|Improvise|Measure everything|Keep it simple
How do I arrange my workspace?|Neat|Organized piles|Minimal|Changes daily
How do I prefer reminders?|Written|Spoken|Phone alert|Calendar
What do I do when a song I love plays?|Sing|Dance|Tap along|Listen quietly
How do I spend a free hour?|Rest|Hobby|Chores|Call someone
How do I approach a puzzle?|Edges first|Patterns first|Random tries|Ask for help
How do I choose clothes?|Comfort|Weather|Mood|Occasion
How do I handle a wrong turn?|Laugh|Check map|Explore|Get frustrated
What do I do after a good movie?|Discuss|Read reviews|Sit quietly|Recommend it
How do I prefer good news?|Call|Text|In person|Surprise visit
How do I grocery shop?|List|Aisle by aisle|Offers|What looks good
How do I choose a book?|Cover|Blurb|Recommendation|Author
How do I handle a slow morning?|Enjoy it|Fill it|Sleep more|Go outside
What is my snack habit?|Sweet|Salty|Fruit|No snacking
How do I take photos?|Many takes|One candid|Details|Rarely
How do I prefer to apologize?|Talk|Write|Helpful action|Give space then talk
How do I celebrate small wins?|Treat|Share news|Tick a box|Quiet smile
How do I keep a new routine?|Track it|Buddy|Alarm|Flexible effort
What do I do with leftovers?|Reheat|Reinvent|Share|Freeze
How do I choose a walking route?|Familiar|Scenic|Shortest|New
How do I react to a compliment?|Say thanks|Blush|Joke|Return one
How do I prepare for guests?|Clean|Cook|Plan activities|Keep it casual
How do I prefer difficult talks?|Right away|After thinking|On a walk|In writing first
How do I sort photos?|Albums|Dates|Favorites|I do not
What do I do before bed?|Read|Scroll|Talk|Listen to music
How do I start a big task?|Research|Make a list|Small first step|Dive in
How do I choose a gift?|Listen for hints|Ask|Browse|Make one
How do I remember names?|Repeat|Association|Write down|Faces help
How do I handle a busy day?|Prioritize|Multitask|Ask help|Push through
What do I do during a commute?|Music|Podcast|Quiet|Reading
How do I prefer a workout?|Alone|With you|Class|Outdoors
How do I react to a broken gadget?|Troubleshoot|Ask help|Read manual|Take a break
How do I drink tea or coffee?|Slowly|Quickly|Forget until cold|With a snack
How do I shop for essentials?|Bulk|As needed|Compare carefully|Familiar brand
How do I handle an early arrival?|Explore|Wait quietly|Message you|Find a cafe
What do I do on a rainy evening?|Cook|Read|Watch|Listen to rain
How do I decide between two good options?|List pros|Gut feeling|Ask you|Sleep on it
How do I unwind after socializing?|Quiet|Talk it over|Sleep|More activity
How do I like affection in public?|Hand-holding|Small gestures|Words|Keep it private
How do I reset a bad day?|Shower|Walk|Comfort food|A hug`;
const dreams = `Where would I live for a month?|Mountains|Coast|Big city|Countryside
What would I learn with a free year?|Language|Instrument|Craft|Sport
What would my dream home feature?|Library|Garden|Big kitchen|Studio
Which adventure calls to me?|Train journey|Road trip|Island stay|Mountain trek
What would I do with extra free time?|Create|Travel|Volunteer|Rest
Which skill would I instantly master?|Cooking|Singing|Painting|Dancing
What kind of business would I imagine?|Cafe|Bookshop|Studio|Workshop
What would I grow in a garden?|Vegetables|Flowers|Fruit|Herbs
Which future tradition would I start?|Annual trip|Weekly date|Seasonal party|Sunday breakfast
What would I write a book about?|Adventure|Life stories|Fantasy|Something practical
What would my ideal morning include?|Exercise|Reading|Slow breakfast|Nature
Which hobby space would I create?|Music room|Art room|Workshop|Reading nook
What would I study for fun?|Astronomy|History|Languages|Design
Which journey would I document?|A long walk|A train trip|A food trail|Our daily life
What would I like us to make?|A home|A garden|A scrapbook|A creative project
Which event would I host?|Dinner|Game night|Picnic|Open mic
What future milestone excites me?|New skill|New home|Big trip|Shared achievement
Where would I watch the stars?|Desert|Mountains|Beach|Backyard
Which animal experience interests me?|Birdwatching|Whale watching|Sanctuary visit|Butterfly garden
What would I like to teach?|A hobby|A language|Cooking|Problem-solving
What would I put in a time capsule?|Letters|Photos|Predictions|Favorite objects
Which place would I explore slowly?|Old town|National park|Museum district|Coastal villages
What would I collect on travels?|Stories|Recipes|Postcards|Small crafts
Which new routine would I try?|Morning walk|Journaling|Meditation|Evening reading
What would I do on a quiet sabbatical?|Write|Garden|Cook|Explore
Which shared challenge sounds fun?|Learn a dance|Cook weekly|Read together|Train for a walk
What would I photograph for a year?|Sky|Street life|Food|Us
Which celebration would I design?|Rooftop dinner|Forest picnic|Beach bonfire|Home feast
What would I want more of in five years?|Peace|Adventure|Creativity|Community
Which creative class would I book?|Pottery|Photography|Writing|Music
What would my dream kitchen have?|Big table|Great oven|Herb window|Coffee corner
Which landscape would I paint?|Sea|Mountains|City|Garden
What kind of volunteering appeals to me?|Teaching|Animals|Environment|Food support
Which small luxury would I choose?|Fresh flowers|Good coffee|Soft bedding|Books
What would I learn to build?|Furniture|A website|A tiny cabin|An instrument
What would I plan for our future weekends?|Trips|Home projects|Lazy mornings|Friends
Which performance would I try?|Singing|Dance|Comedy|Storytelling
What would I explore underwater?|Coral|Marine life|Shipwrecks|Stay on shore
Which winter trip sounds best?|Snowy cabin|City lights|Sunny escape|Family visit
What would I want to be remembered for?|Kindness|Creativity|Courage|Reliability
What kind of pet life would I imagine?|A dog|A cat|Small animals|No pets
Which dream date would I plan?|Stargazing|Cooking class|Scenic train|Private concert
What future home sound appeals to me?|Laughter|Music|Birds|Quiet
Which habit would I love to build together?|Walks|Cooking|Saving memories|Trying new things
What would I do with a bonus day off?|Trip|Sleep|Hobby|See loved ones
Which destination would I choose by feel?|Colorful streets|Quiet coast|Green hills|Busy markets
What would I put on a shared bucket list first?|Journey|Skill|Experience|Home project
Which project would make me proud?|Useful invention|Art collection|Community event|Beautiful garden
What would my ideal evening look like years from now?|Dinner together|Walk|Games|Reading side by side
What kind of adventure would I choose with you?|Planned|Spontaneous|Comfortable|A little challenging`;
const rather = `A rooftop breakfast|A moonlit picnic
Learn pottery together|Learn a dance together
A surprise weekend trip|A perfectly planned day out
Cook without a recipe|Build without instructions
A home cinema night|An outdoor concert
Live near the sea|Live near the mountains
Share a dessert|Order two and trade bites
Take a scenic train|Take a winding road trip
Have a tiny garden|Have a huge balcony
Watch sunrise together|Watch sunset together
Find a hidden bookshop|Find a hidden cafe
Learn each other's hobby|Start a new hobby together
Stay in a treehouse|Stay on a houseboat
Write letters for a year|Make monthly photo albums
Visit every local park|Try every local bakery
Have a picnic in winter|Have a bonfire in summer
Plan a mystery date|Receive a mystery date
Travel with one backpack|Travel with every comfort
Make matching mugs|Make matching playlists
Have breakfast for dinner|Have dessert for breakfast
Speak in rhymes all day|Sing every greeting all day
Always find the perfect parking spot|Always find the quietest table
Own a reading nook|Own a craft studio
Try a new food weekly|Master one dish monthly
Explore a castle|Explore a botanical garden
Have a friendly cooking contest|Have a friendly drawing contest
Go kayaking|Go cycling
Take a photo every day|Write one sentence every day
Learn an instrument|Learn a language
Plan a trip around food|Plan a trip around nature
Make a puzzle together|Make a model together
Sleep under the stars|Sleep beside a fireplace
Explore an old city|Explore a new trail
Have an unlimited library card|Have unlimited concert tickets
Dance in the kitchen|Sing in the car
Always know the weather|Always know the traffic
Receive a handmade gift|Receive a shared experience
Host a game night|Host a themed dinner
Have a slow Sunday|Have an adventurous Saturday
Go to an aquarium|Go to a planetarium
Trade outfits for a day|Trade playlists for a week
Visit a floating market|Visit a night market
Find a message in a bottle|Find a forgotten photograph
Have a home full of plants|Have a home full of books
Create a tiny tradition|Plan a huge celebration
Eat only crunchy snacks for a week|Eat only soft snacks for a week
Be great at remembering names|Be great at finding lost things
Take a painting class|Take a baking class
Live above a bakery|Live beside a park
Have a secret handshake|Have a secret code word
Have a rainy cabin weekend|Have a sunny beach weekend
Design our dream room|Design our dream holiday
Go berry picking|Go flower picking
Try a tandem bicycle|Try a paddleboat
Make a breakfast surprise|Make a midnight snack surprise
Have your own theme song|Have your own signature dessert
Visit a quiet museum|Visit a lively street festival
Enjoy a phone-free evening|Enjoy a completely unplanned day
Read the same book|Watch the same documentary
Trade chores for a week|Do all chores together for a day
Have an extra hour each morning|Have an extra hour each evening
Go camping with a full kitchen|Go glamping with a great bed
Learn to juggle|Learn a magic trick
Watch a meteor shower|Watch a lightning storm safely indoors
Make a comic about us|Make a short film about us
Own a tiny boat|Own a tiny camper
Go on a silent walk|Go on a storytelling walk
Have a personal chef once a month|Have a cleaner once a month
Meet your favorite author|Meet your favorite musician
Take a hot-air balloon ride|Take a scenic cable car
Explore a cave with a guide|Explore a forest with a guide
Invent a board game|Invent a dessert
Visit five places briefly|Know one place deeply
Have a dinner with no phones|Have a date with no clocks
Try a new sport|Try a new art form
Enjoy a seaside breakfast|Enjoy a mountain dinner
Always have fresh bread|Always have fresh fruit
Visit a city by bicycle|Visit a city on foot
Build a blanket fort|Build a backyard tent
Dress up for dinner at home|Wear pajamas to a movie night
Listen to an album start to finish|Read poems aloud together
Learn to make pasta|Learn to make dumplings
Spend a day in a water park|Spend a day in an amusement park
Go on a food treasure hunt|Go on a photo treasure hunt
Have matching raincoats|Have matching slippers
Go to a sunrise yoga class|Go to a sunset dance class
Own an outdoor shower|Own a deep bathtub
Share a journal|Share a recipe book
Make homemade ice cream|Make homemade bread
Visit a lighthouse|Visit an observatory
Keep every ticket stub|Keep every handwritten note
Have a holiday with no photos|Have a holiday with no shopping
Spend a day learning local history|Spend a day learning local recipes
Get caught in light rain|Get surprised by a cool breeze
Decorate with vintage finds|Decorate with handmade pieces
Discover a secret beach|Discover a quiet mountain lake
Have a weekly breakfast date|Have a weekly evening walk
Play a cooperative game|Play a competitive game
Take a long ferry ride|Take a long train ride
Have a colorful kitchen|Have a peaceful bedroom
Plan our next adventure on paper|Plan our next adventure with a map
Wear only warm colors for a week|Wear only cool colors for a week
Be able to sketch anything|Be able to play any melody
Find the best local noodles|Find the best local cake
Grow tomatoes|Grow strawberries
Go to a tiny theater|Go to an open-air cinema
Volunteer at a garden|Volunteer at a food drive
Walk through autumn leaves|Walk through spring blossoms
Have a closet that organizes itself|Have dishes that wash themselves
Create a family recipe|Create a holiday tradition
Take a scenic detour|Arrive early and relax
Have one incredible travel photo|Have a notebook full of travel stories
Have an all-day brunch|Have a three-course midnight dinner
Learn calligraphy|Learn origami
Go to a jazz cafe|Go to a poetry night
Make a miniature house|Make a giant painting
Have a secret picnic spot|Have a favorite neighborhood table
Explore a city at dawn|Explore a city after dark
Own a hammock|Own a rocking chair
Try archery at a supervised range|Try indoor climbing with an instructor
Cook food from our childhoods|Cook food from a place neither has visited
Read by a window during rain|Listen to music by a fireplace
Celebrate a half-birthday|Celebrate the anniversary of a tiny moment
Receive a puzzle invitation|Receive a handwritten invitation
Have a beach treasure hunt|Have a museum scavenger hunt
Discover a new favorite song|Rediscover an old favorite song
Take an overnight train|Take a daytime coastal train
Have a mountain-view workspace|Have a garden-view kitchen
Watch birds together|Watch clouds together
Visit an artisan workshop|Visit a working farm
Make our own candles|Make our own soap
Have a snack tasting night|Have a mocktail mixing night
Visit somewhere by boat|Visit somewhere by bicycle
Have an evening with only candlelight|Have an evening with only fairy lights
Try a recipe in another language|Try assembling a kit without pictures
Keep a shared gratitude jar|Keep a shared adventure jar
Go on a bookstore date|Go on an art-supply date
Have a picnic with fancy plates|Have a fancy dinner with picnic food
Learn to recognize constellations|Learn to recognize birdsong
Find a great secondhand jacket|Find a great secondhand book
Spend a day making gifts|Spend a day making memories
Be known for great breakfasts|Be known for great dinner parties
Try a new hairstyle temporarily|Try a new clothing style temporarily
Design a flag for us|Design a logo for us
Go to a sculpture park|Go to a butterfly garden
Learn a traditional craft|Learn a modern creative tool
Have a completely quiet hour together|Have an hour of uninterrupted conversation
Make a playlist for our future|Make a playlist for our past
Have a date picked by a coin toss|Have a date picked from a jar
End a trip with a fancy dinner|End a trip with a cozy takeaway`;
const roulette: Record<string, string> = {
sweet: `truth|What tiny gesture from me do you remember?
truth|When did you last feel cared for?
truth|What compliment would you like to hear more?
truth|Which ordinary moment with us feels special?
truth|What does a comforting evening look like to you?
truth|What is something you admire about us?
truth|Which photo of us makes you smile?
truth|What is a little tradition you want to keep?
truth|Which shared meal would you repeat?
truth|What is one kind thing you noticed this week?
truth|Which song reminds you of a happy moment?
truth|What is your favorite way to say hello?
truth|What would you put in a thank-you note to me?
dare|Give your partner a sincere three-sentence compliment.
dare|Draw a tiny postcard of a favorite shared moment.
dare|Make up a warm nickname for tonight, with their approval.
dare|Describe your partner as a cozy place.
dare|Write a two-line note for a future rough day.
dare|Offer a hug or a friendly wave; let your partner choose.
dare|Name three little things you appreciate right now.
dare|Create a tiny toast with water to something we did well.
dare|Tell a favorite memory using only five words.
dare|Plan a small kindness for tomorrow and say it aloud.
dare|Draw a flower for your partner without lifting your pen.
dare|Pick a song title that captures your mood together.
dare|Say a compliment as if introducing an award winner.`,
funny: `truth|What is your most harmless irrational dislike?
truth|Which kitchen utensil matches your personality?
truth|What is a funny word you love saying?
truth|Which fictional job would you be terrible at?
truth|What is your funniest autocorrect memory?
truth|What food would you rename and to what?
truth|What would your very silly superhero weakness be?
truth|Which animal would narrate your life best?
truth|What would the title of your morning routine be?
truth|What is a tiny thing you are oddly competitive about?
truth|Which household item deserves a theme song?
truth|What would your warning label say on a sleepy day?
truth|Which snack would make a terrible currency?
dare|Advertise a nearby cushion as a luxury invention.
dare|Give a weather report about your current mood.
dare|Invent a dramatic backstory for a spoon.
dare|Speak like a polite robot for one sentence.
dare|Perform a silent movie version of making tea.
dare|Narrate your partner taking a sip like a sports commentator.
dare|Draw a cat with your non-dominant hand.
dare|Invent a new dance using only your shoulders.
dare|Explain socks as if nobody has seen them before.
dare|Make up a harmless villain whose plan involves laundry.
dare|Give a solemn acceptance speech for finishing breakfast.
dare|Name three imaginary flavors of clouds.
dare|Tell a ten-second story with the words moon, toast, and umbrella.`,
adventurous: `truth|Which safe new activity would you try with me?
truth|What nearby place have you never explored?
truth|What is your idea of a tiny adventure?
truth|Which skill would make travel more fun?
truth|What would you choose for an unplanned day out?
truth|Which food have you been curious to try?
truth|What is a journey you would take slowly?
truth|Which season makes you feel adventurous?
truth|What would you pack for a one-day mystery trip?
truth|Which kind of guided tour would you enjoy?
truth|What is a small comfort zone you might stretch?
truth|What would your ideal first camping night include?
truth|What adventure would you enjoy without leaving home?
dare|Choose a nearby place for a future daytime walk together.
dare|Sketch a map of an imaginary island for us.
dare|Invent a safe indoor scavenger hunt with three objects.
dare|Find something nearby you have never noticed and describe it.
dare|Plan a no-cost mini adventure in three steps.
dare|Try drawing your name backwards on paper.
dare|Choose a new recipe to try together another day.
dare|Invent a new greeting and invite your partner to try it.
dare|Use a nearby object as a pretend travel souvenir and explain it.
dare|Describe a destination without naming it for your partner to guess.
dare|Create a packing list for a trip to the moon using five things.
dare|Pick a constellation to learn about together later.
dare|Make a paper trail map with three imaginary landmarks.`,
deep: `truth|What helps you feel listened to?
truth|What is a belief you have gently changed?
truth|When do you feel most like yourself?
truth|What does rest mean to you lately?
truth|What is something you are quietly proud of?
truth|What kind of support is helpful on a hard day?
truth|What would you like to make more time for?
truth|What does a fair disagreement look like to you?
truth|Which value do you want our routines to reflect?
truth|What is one thing you hope to learn about yourself?
truth|What makes a place feel like home?
truth|What boundary helps you feel comfortable?
truth|What is a hope you are comfortable sharing tonight?
dare|Finish the sentence: I feel supported when...
dare|Name one thing you would like to do more slowly.
dare|Share a small goal and one manageable next step.
dare|Describe your ideal listening response in one sentence.
dare|Tell your partner one strength you see in them.
dare|Take a comfortable quiet breath together, if you both want.
dare|Name something you learned from a kind person.
dare|Complete the sentence: A peaceful day includes...
dare|Offer one gratitude about your shared life.
dare|Write a word that captures what you want this month.
dare|Describe a small way to make tomorrow easier for both of you.
dare|Share a question you wish people asked you more often.
dare|Name a gentle promise you can realistically keep this week.`,
};
export const KNOW: Prompt[] = Object.entries({ favorites, memories, habits, dreams }).flatMap(([category, content]) => content.split('\n').map((line, i) => { const [text = '', ...options] = line.split('|'); return { id: `know-${category}-${i}`, game: 'know' as const, category, text, options }; }));
export const RATHER: Prompt[] = rather.split('\n').map((line, i) => ({ id: `rather-${i}`, game: 'rather', category: 'together', text: 'Would you rather…', options: line.split('|') }));
export const ROULETTE: Prompt[] = Object.entries(roulette).flatMap(([category, content]) => content.split('\n').map((line, i) => { const [kind, text = ''] = line.split('|'); return { id: `roulette-${category}-${i}`, game: 'roulette' as const, category, text, options: [], kind: kind as 'truth' | 'dare' }; }));
export const BUNDLED = [...KNOW, ...RATHER, ...ROULETTE];
