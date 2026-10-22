/**
 * FAQ item seeds. IDs follow `faq-<vehicle-slug>-<n>`. Two per current vehicle.
 * Answers are RichText documents built with the local helper below.
 */

const text = (value) => ({ nodeType: 'text', value, marks: [], data: {} });
const paragraph = (value) => ({ nodeType: 'paragraph', data: {}, content: [text(value)] });
const doc = (...paragraphs) => ({ nodeType: 'document', data: {}, content: paragraphs.map(paragraph) });

// Rows: [question, ...answer paragraphs]
const FAQS = {
  artura: [
    ['How does the Gavia hybrid system work?', 'A twin-turbo V6 drives the rear wheels through an eight-speed transmission. An electric motor sits between the engine and the gearbox and adds torque at any speed.', 'A battery pack under the floor supplies the motor and recharges through the engine, regeneration and a charging port.'],
    ['Can the Gavia run on electric power alone?', 'Yes. In electric mode the car runs on the motor alone for short distances at low speed. The V6 starts when you demand more power or the battery needs support.'],
  ],
  'artura-spider': [
    ['How quickly does the Gavia Spider roof open?', 'The folding hard top stows behind the cabin in a matter of seconds. It operates at low speed, so you can open it at a junction or a traffic light.'],
    ['Does the Spider give up performance to the coupé?', 'Output is the same at 680 PS. The Spider carries some extra mass for the roof mechanism, and the figures reflect that. The carbon structure keeps the chassis response intact.'],
  ],
  '750s': [
    ['What changed from the Falzarego to the Pordoi?', 'Power rose to 750 PS and torque to 800 Nm. Mass fell through lighter components throughout the car, and the aerodynamics were revised for greater downforce.'],
    ['Is the Pordoi practical for everyday use?', 'Yes. The nose lift system raises the front axle over kerbs and ramps, and the cabin has stowage space for daily needs. The ride softens in the comfort setting.'],
  ],
  '750s-spider': [
    ['What is the difference between the Pordoi and the Pordoi Spider?', 'The Spider adds a folding hard top and a reinforced upper structure. The engine, the chassis tuning and the output are shared with the coupé.', 'The roof adds a small amount of mass, which the figures show.'],
    ['Can the roof be operated while driving?', 'Yes, at low speed. The roof stows or deploys in seconds and the system will not operate above its set speed limit.'],
  ],
  gts: [
    ['How much luggage does the Sella carry?', 'Stowage sits in the nose and above the engine. Together they take bags for two people for a long weekend.', 'Exact volumes are listed in the vehicle specification once published.'],
    ['What makes the Sella a grand tourer?', 'The chassis is tuned for ride comfort at pace. The seats, the cabin acoustics and the stowage suit long distances without taking away the driver involvement.'],
  ],
  w1: [
    ['What does the Mortirolo add to the Strada Nova ultimate lineage?', 'It follows the Gardena and the Fedaia as the most advanced road car Strada Nova builds. Active aerodynamics, a hybrid V8 and a one-piece carbon structure are designed as one system.'],
    ['Is the Mortirolo available to order?', 'Production is limited. Use the enquiry link to contact a retailer, who will confirm availability and specification options.'],
  ],
};

/** FAQ entry IDs per vehicle slug, in display order. */
export const FAQS_BY_VEHICLE = {};

export const FAQ_SEEDS = Object.entries(FAQS).flatMap(([slug, rows]) =>
  rows.map(([question, ...answer], index) => {
    const id = `faq-${slug}-${index + 1}`;
    (FAQS_BY_VEHICLE[slug] ??= []).push(id);
    return { id, contentType: 'faqItem', fields: { question, answer: doc(...answer) } };
  }),
);

export const FAQ_GROUP = { name: 'faqs', assets: [], entries: FAQ_SEEDS };
