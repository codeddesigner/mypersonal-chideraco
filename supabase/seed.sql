-- Chidera.com — starter content. Replace these placeholder essays from /admin.

-- The first admin: replace with the email you'll sign up with.
insert into private.admin_emails (email) values ('you@example.com') on conflict do nothing;

insert into public.topics (name, slug, sort_order) values
  ('Business', 'business', 1),
  ('Finance', 'finance', 2),
  ('Society', 'society', 3),
  ('Religion', 'religion', 4),
  ('Relationships', 'relationships', 5),
  ('Love', 'love', 6),
  ('Design', 'design', 7),
  ('Technology', 'technology', 8),
  ('Culture', 'culture', 9),
  ('Personal essays', 'personal-essays', 10)
on conflict (slug) do nothing;

update public.site_settings set about_body = $a$I write about business, finance, society, religion, relationships, and the things that shape how we think and live.

This site is a notebook kept in public: articles and observations worked through slowly enough to stand behind. Some are practical, some are personal, and all of them are attempts to think clearly about questions that matter.

## On writing and thinking

I write to find out what I think. Most of these pieces began as a vague conviction and changed shape on the page. I would rather publish less and mean it than keep pace with the news cycle.

I try to write the way I would talk to a thoughtful friend: directly, without jargon, and with room for doubt.

## Background and selected work

A short professional background and selected work will appear here.$a$
where id = true;

with src (slug, title, description, published_at, access, featured, topics, body) as (values
($s$what-money-is-actually-for$s$, $s$What money is actually for$s$,
 $s$Money is very good at one job: buying the freedom to say no. It needs clear instructions to do it.$s$,
 '2026-10-14 08:00+01', 'members', true, array['finance', 'personal-essays'],
$b$For most of my twenties I treated money as a scoreboard. The number in the account was a verdict on whether I was doing well, and like any scoreboard, it only ever pointed in one direction: more.

It took me an embarrassingly long time to ask the obvious question. What is the money for? Not in the abstract. Specifically. What would I do with it that I am not already doing, and what am I giving up to get it?

## Money buys options, not happiness

The most useful thing money does is not purchase things. It purchases the ability to say no. No to a client who treats you badly. No to a job that is slowly emptying you. No to a decision made in panic because rent is due on Friday.

People who have never had a financial cushion often describe the first one as a physical sensation. The shoulders drop. You start to think in years instead of weeks. That shift is worth more than almost anything the same amount of money could buy in a shop.

## The trap of the moving line

The difficulty is that "enough" keeps moving. Every increase in income comes with a quiet increase in what feels normal. The car gets a little nicer, the restaurants a little more expensive, and before long the cushion that was supposed to buy freedom has been converted into a lifestyle that needs the same income to sustain it.

I don't think the answer is austerity. I think the answer is to decide, deliberately and in writing, what the money is for before it arrives. Otherwise it will decide for you.

## A simple exercise

Write down three things you want money to do for you in the next five years. Not things you want to own: things you want it to *do*. Buy time with your parents. Let you leave a job without fear. Fund the business you keep postponing.

Then look at where your money actually went last month.

The gap between those two lists is the most honest financial statement you will ever read.

## What I believe now

Money is a tool for building a life you don't need to escape from. It is very good at that job when you give it clear instructions, and very bad at it when you don't.

The scoreboard was never the point. The point was always the game you wanted to be free to play.$b$),

($s$why-small-businesses-really-fail$s$, $s$Most small businesses don't die from competition$s$,
 $s$Competition gets the blame. Cash timing, founder bandwidth and drift do most of the damage.$s$,
 '2026-10-02 08:00+01', 'members', false, array['business'],
$b$When a small business closes, the story people tell is usually about competition. A bigger company moved in. Someone undercut the prices. The market got crowded.

Sometimes that is true. More often, in my experience, the business died of something quieter and closer to home.

## The three quiet killers

**Cash timing.** Plenty of profitable businesses fail because money arrives later than the bills do. A company can be growing and winning customers and still run out of cash because it paid suppliers in thirty days and was paid by clients in ninety.

**Founder bandwidth.** In the early years the founder is the business. Every decision, every relationship, every fire passes through one person. When that person gets tired, sick or distracted, the whole thing slows down, and nobody outside notices until it is too late.

**Drift.** The original idea was clear. Then a large client asked for something slightly different, and then another one did, and three years later the business is doing six things badly instead of one thing well.

## Competition is often a symptom

When a competitor takes your customers, it is worth asking why they were available to be taken. Usually the answer points back to one of the quiet killers: the service slipped because the founder was stretched, prices rose because cash was tight, or the offering became vague.

This is good news, in a way. You cannot control what a competitor does. You can control your payment terms, how much you personally carry, and how disciplined you are about saying no.

## What to watch

If I were running a small business again tomorrow, I would watch three numbers every week: cash on hand, days until the next major bill, and the number of decisions that only I can make. The first two tell you how much time you have. The third tells you how fragile you are.

Competition is loud, so it gets the blame. The things that actually close businesses tend to be quiet.$b$),

($s$faith-without-performance$s$, $s$Faith without performance$s$,
 $s$On the difference between visible faith and performed faith, and what remains when no one is watching.$s$,
 '2026-09-20 08:00+01', 'members', false, array['religion', 'personal-essays'],
$b$I grew up in a church where faith was very visible. You could see it in the clothes, hear it in the volume of the prayers, count it in the number of services attended in a week. There was a great deal that was beautiful about that world, and I still carry much of it with me.

But somewhere along the way I began to notice how easily visible faith turns into performed faith.

## The audience problem

Performance needs an audience. Once faith becomes something we do in front of others, the question quietly shifts from *Is this true?* to *How does this look?* We start to measure devotion in ways that can be observed: attendance, giving, the right words at the right time.

None of these things are bad. The problem is what happens when they become the point. A person can tick every visible box and still be hollow inside, and a person can be wrestling honestly with God in silence and look, from the outside, as if they have drifted away.

## What remains when no one is watching

The question I keep returning to is simple: what would my faith look like if no one ever saw it?

For me, the answer is smaller and quieter than I expected. It looks like keeping my word when breaking it would be easier. It looks like patience with people who have not earned it. It looks like prayer that is mostly listening.

## Room for doubt

Performed faith has little room for doubt, because doubt looks bad. But every serious tradition I know of makes space for questions. The psalms are full of complaint. The prophets argue. Doubt, held honestly, is often a sign that a person is taking belief seriously rather than wearing it as a costume.

I am not arguing against community, ritual or public worship. I love all three. I am arguing that they should be the expression of something real, not a substitute for it.

Faith that has to be seen to be real was probably never very real to begin with.$b$),

($s$love-is-a-practice$s$, $s$Love is a practice, not a feeling$s$,
 $s$The feeling starts it. Small, repeated, ordinary choices are what make it last.$s$,
 '2026-09-05 08:00+01', 'members', false, array['love', 'relationships'],
$b$We talk about love as if it were weather. We *fall* into it. It *happens* to us. Sometimes it fades, and we speak about that as if it were also beyond our control, like a season changing.

I understand why. The early stage of love really does feel like something arriving from outside. But I have come to believe that this description, repeated often enough, does real damage to the way we build relationships.

## Feelings are the beginning

The intense feeling at the start of a relationship is real, and it matters. It is the spark that makes two people willing to take the risk of knowing each other. But it is not designed to last, and it was never meant to carry the weight of a shared life.

What carries that weight is practice: small, repeated choices that most of the time feel completely ordinary.

## What the practice looks like

It looks like listening to the whole story even when you think you know how it ends. It looks like apologising first, even when you are only forty per cent wrong. It looks like noticing what the other person needs before they have to ask, and asking when you cannot tell.

None of this is glamorous. Very little of it makes it into songs. But it is the difference between relationships that deepen over time and relationships that simply wear out.

## The freedom in this view

There is something freeing about seeing love as a practice. If love is only a feeling, then when the feeling dims there is nothing to do except panic or leave. If love is a practice, a dim season is a signal to return to the basics: attention, generosity, honesty, time.

Feelings follow behaviour more often than we admit. Act with care for long enough and the warmth tends to come back.

Love may begin as something that happens to you. It lasts as something you do.$b$),

($s$the-interest-rate-on-your-habits$s$, $s$The interest rate on your habits$s$,
 $s$Everything compounds, not just money. The question is which habits you want working for you.$s$,
 '2026-08-18 08:00+01', 'members', false, array['finance'],
$b$Everyone understands compound interest when it is explained with money. Save a little, let it grow, and after enough years the growth starts to do more work than your contributions. The chart curves upward, and the lesson is always the same: start early.

What we talk about less is that almost everything in life compounds, and not always in our favour.

## Habits have interest rates

Reading twenty pages a day does not feel like much on any given day. Over ten years it is roughly a hundred books, and the ideas in those books start to connect with each other in ways that make every new book more valuable than the last.

Scrolling for two hours a day also compounds. It shapes what you notice, what you find boring, how long you can hold a thought. The cost does not arrive as a bill. It arrives as a slow change in who you are.

## Negative compounding is quiet

The dangerous habits are rarely the dramatic ones. They are small, comfortable and repeated: the minor expense that becomes automatic, the skipped workout that becomes the default, the conversation you keep postponing until it becomes impossible to have.

Like debt, these habits are easy to take on and expensive to unwind.

## Choosing what compounds

The practical question is not how to become a perfectly disciplined person. Very few people manage that. The question is which two or three things you want working in your favour for the next decade, and how to make them so small and easy that you never skip them.

A small habit kept for ten years beats an ambitious one abandoned in March.

## The best time to start

The old line about planting trees applies here. The best time to start was years ago. The second best time is today, and the person you are ten years from now will be living on the interest.$b$),

($s$design-is-how-it-feels-at-2am$s$, $s$Design is how it feels at 2 a.m.$s$,
 $s$The real test of a product is the tired person using it on a cracked phone with one bar of signal.$s$,
 '2026-07-29 08:00+01', 'members', false, array['design', 'technology'],
$b$There is a version of design that happens in presentations. Everything is shown on a large screen, in perfect light, with sample data that fits neatly into every box. Everyone in the room is rested and paying attention.

And then there is the version of design that people actually experience.

## The real test

The real test of a product is how it feels to someone who is tired, distracted and slightly anxious, using it at two in the morning on a cracked phone with one bar of signal. That person does not care about your colour palette. They care about whether they can find the button, whether the page loads, and whether the error message tells them what to do next.

Most of the meaningful decisions in design are made for that person, not for the one in the presentation.

## Clarity over cleverness

Clever interfaces are fun to build and satisfying to show. They are also, very often, harder to use. Every unusual gesture, every hidden menu, every icon without a label asks the user to learn something before they can do what they came to do.

The best design I know feels almost boring. You open it, you understand it, you finish your task and you leave. Nothing is memorable because nothing got in the way.

## Respecting attention

Good design treats attention as something borrowed, not owned. It does not interrupt without reason. It does not make you hunt for the thing you need. It does not dress up a simple action as an experience.

This website is an attempt to follow that principle: words first, as little interface as possible, nothing that moves unless it needs to.

Design is not how it looks in the meeting. It is how it feels at 2 a.m.$b$),

($s$what-lagos-teaches-you-about-speed$s$, $s$What Lagos teaches you about speed$s$,
 $s$A city that runs on urgency produces remarkable people. It also makes it hard to tell what matters.$s$,
 '2026-07-08 08:00+01', 'members', false, array['culture', 'society'],
$b$If you want to understand urgency, spend a week in Lagos.

The city does not wait for you. Traffic moves in bursts, deals are made in the time it takes to cross a street, and everyone seems to be running three things at once. Visitors often describe it as chaos. People who live there know it is closer to a dense, improvised order that rewards anyone who can read it quickly.

## Speed as a survival skill

When infrastructure is unreliable, speed becomes a form of insurance. You learn to act before conditions change, because they will change. The power might go off this afternoon. The road might close tomorrow. The price might be different next week.

That environment produces remarkable people: resourceful, quick to decide, comfortable with uncertainty in a way that people from more predictable places often are not.

## The cost of always running

But speed has a cost, and it is worth naming. When everything is urgent, it becomes hard to tell what is important. Long-term projects struggle against the constant pull of the immediate. Rest starts to feel like falling behind.

I have watched talented friends burn out, not because they lacked ability, but because the environment never let them stop long enough to choose a direction.

## Taking the best of it

The lesson I have taken from the city is not that speed is good or bad. It is that speed is a tool. Used deliberately, it lets you seize opportunities others are too slow to see. Used by default, it turns into motion without progress.

The skill is knowing when to move like Lagos and when to move like someone with all the time in the world. Both are necessary. The trick is choosing.$b$),

($s$on-being-early$s$, $s$On being early$s$,
 $s$Being early feels a lot like being wrong. The hard part is surviving the long middle.$s$,
 '2026-06-16 08:00+01', 'members', false, array['business', 'technology'],
$b$Being early feels a lot like being wrong.

When you see something before others do, whether it is a technology, a market or a shift in how people live, the first reaction from most of the people around you will be confusion. Not hostility, usually. Just a polite lack of interest. The thing you are excited about does not yet make sense to them, because the conditions that will make it obvious have not arrived.

## The long middle

The hardest part of being early is the long middle: the stretch between seeing something clearly and the world agreeing with you. It can last years. During that time you have very little evidence to point to, and plenty of reasons to doubt yourself.

Many people who are right about the future give up during this stretch. Not because they were wrong, but because they could not afford to keep being right for that long.

## Early and right are different things

It is also important to be honest: plenty of people who feel early are simply wrong. The feeling of seeing something others miss is the same whether or not you are correct. The only defence is to keep testing your belief against reality, as cheaply as possible, for as long as necessary.

That means small experiments, honest conversations with potential customers, and a willingness to change your mind when the evidence is clear.

## Surviving the wait

If you think you are early, the most important question is not whether you are right. It is whether you can afford to wait. Keep costs low. Build something small that pays for itself. Find a few people who understand what you see.

Timing is not only about seeing the future. It is about still being around when it arrives.$b$),

($s$the-friendship-audit$s$, $s$The friendship audit$s$,
 $s$Adult friendships survive because someone maintains them. Usually that someone has to be you.$s$,
 '2026-05-27 08:00+01', 'members', false, array['relationships', 'personal-essays'],
$b$At some point in adulthood, friendship stops happening automatically.

At school and university, friendships are a side effect of proximity. You see the same people every day without trying. Then life scatters everyone: different cities, different jobs, children, schedules that never align. The friendships that survive are the ones somebody actively maintains, and most of us never noticed when that responsibility became ours.

## An uncomfortable exercise

A few years ago I sat down and listed the people I considered close friends. Next to each name, I wrote the last time we had a real conversation. Not a reaction to a photo. A conversation.

The results were uncomfortable. Some of the people I thought of as my closest friends I had not truly spoken to in over a year.

## Friendship is not self-sustaining

We tend to assume that real friendships can survive neglect. Sometimes they can; there are people you can pick up with after years as if no time has passed. But that is a gift, not a rule. Most friendships, like most living things, need regular attention to stay alive.

The attention does not need to be grand. A message that says *I thought of you today*. A call on a birthday. A visit when you happen to be in their city.

## Who you keep

The audit also showed me something harder: a few relationships that were costing more than they gave. Not because anyone was a bad person, but because we had grown in different directions and were maintaining the friendship out of habit and guilt.

Letting those drift, gently and without drama, made room for the ones that mattered.

Friendship is one of the great pleasures of being alive. It deserves at least as much planning as our careers.$b$),

($s$what-we-inherit-and-what-we-choose$s$, $s$What we inherit and what we choose$s$,
 $s$We are handed beliefs before we can examine them. Choosing them later is a form of respect.$s$,
 '2026-05-04 08:00+01', 'members', false, array['culture', 'religion'],
$b$Every one of us is handed a set of beliefs before we are old enough to examine them. Our families give us a religion or the absence of one, a sense of what success looks like, and ideas about marriage, money, work and honour. By the time we can think for ourselves, these ideas are already part of the furniture.

## The two easy responses

There are two easy ways to respond to an inheritance like this.

The first is to accept all of it without question, because questioning feels like betrayal. The second is to reject all of it, because rejecting feels like freedom. Both are understandable, and both skip the actual work.

## The harder path

The harder path is to go through the inheritance piece by piece. To ask of each belief: Where did this come from? What problem was it solving for the people who handed it to me? Does that problem still exist? Is this belief true, useful, or both?

Some of what we inherit turns out to be wisdom that took generations to earn: respect for elders, the importance of community, a sense that life is bigger than the individual. Some of it turns out to be fear dressed up as tradition.

## Choosing is a form of respect

I have come to think that examining your inheritance is not disrespectful to the people who gave it to you. It is the opposite. Accepting beliefs without understanding them treats them as rules. Examining them treats them as ideas worth taking seriously.

The beliefs I hold most firmly now are, in many cases, the same ones I was raised with. The difference is that I have chosen them.

That difference matters more than it might seem.$b$),

($s$pricing-is-a-statement-of-belief$s$, $s$Pricing is a statement of belief$s$,
 $s$Price is never just arithmetic. It is a statement about what you believe your work is worth.$s$,
 '2026-04-15 08:00+01', 'subscribers', false, array['business', 'finance'],
$b$Most people treat pricing as arithmetic. Add up your costs, look at what competitors charge, choose a number somewhere in the middle and move on.

But a price is never only a number. It is a statement about what you believe your work is worth, who you believe it is for, and how confident you are in both.

## Underpricing is a story

When I look at businesses that charge too little, there is almost always a story underneath. Sometimes it is fear: if I charge more, nobody will buy. Sometimes it is a sense that the work is not quite good enough yet. Sometimes it is a moral discomfort with asking for money at all.

These stories are understandable, but they have consequences. Low prices attract customers who choose mainly on price, and those customers tend to leave the moment someone cheaper appears. Low prices leave very little margin for quality, for rest, or for mistakes.

## What a price communicates

Customers read prices as signals. A price that is too low can make a careful buyer suspicious: what is wrong with it? A price that is clear and confident tells people you understand the value of what you offer and intend to deliver it.

This does not mean every business should be expensive. It means the price should be a deliberate choice that matches the promise.

## Raising prices honestly

If you suspect you are undercharging, the honest move is to improve what you deliver and then charge for it. Tell existing customers early. Explain what is changing. Some will leave, and that is part of the process.

The ones who stay are telling you something valuable: that the work is worth what you said it was.

A price is a belief written down. Make sure it is one you actually hold.$b$),

($s$saying-less-in-public$s$, $s$Saying less in public$s$,
 $s$Opinions formed in an hour are rarely worth holding for a year.$s$,
 '2026-03-22 08:00+01', 'subscribers', false, array['society', 'technology'],
$b$There has never been a time when it was easier to share an opinion, and I am not sure there has ever been a time when it was harder to think one through.

Every day brings a new event that everyone is expected to have a view on, preferably immediately. Silence is read as indifference. Hesitation is read as weakness. The reward goes to whoever is fastest and most certain.

## The cost of instant opinions

Opinions formed in an hour are rarely worth holding for a year. Yet once something is said in public, it tends to harden. We defend it, because changing our minds in front of an audience feels like losing. The speed of the conversation pushes us toward positions we never really chose.

## Writing as slowing down

One of the reasons I write longer pieces is that writing forces me to slow down. A short post can hide a weak argument. Two thousand words cannot. By the time I finish a draft, I often believe something different from what I believed when I started, and that is usually a sign the writing did its job.

## A modest practice

I have tried to adopt a simple rule: if I would not be comfortable defending an opinion at length, I do not need to share it in public yet. That leaves plenty of room for conversation with friends, for questions, for uncertainty. It just keeps half-formed thoughts out of the permanent record.

Saying less in public has not made me less engaged with the world. If anything, it has made me more careful with the things I do say.

There is a quiet freedom in not having to have a view on everything. Most things can wait until you have actually thought about them.$b$)
),

ins as (
  insert into public.articles (slug, title, description, preview, status, published_at, access, featured)
  select slug, title, description,
    array_to_string((regexp_split_to_array(body, E'\n\n'))[1:2], E'\n\n'),
    'published', published_at::timestamptz, access::public.access_level, featured
  from src
  on conflict (slug) do nothing
  returning id, slug
),
bodies as (
  insert into public.article_bodies (article_id, body)
  select ins.id, src.body from ins join src on src.slug = ins.slug
  returning article_id
)
insert into public.article_topics (article_id, topic_id)
select ins.id, t.id
from ins
join src on src.slug = ins.slug
cross join lateral unnest(src.topics) as st(topic_slug)
join public.topics t on t.slug = st.topic_slug;

-- Reading time is normally set by a trigger on save; compute it once for the seed.
update public.articles a
set reading_minutes = greatest(1, ceil(coalesce(array_length(regexp_split_to_array(btrim(b.body), '\s+'), 1), 0) / 230.0)::int)
from public.article_bodies b
where b.article_id = a.id;
