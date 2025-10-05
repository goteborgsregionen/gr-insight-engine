-- Insert admin role for Rasim
INSERT INTO public.user_roles (user_id, role)
VALUES ('d24e11f8-ab13-419c-b4ce-449c79d18fe0'::uuid, 'admin'::app_role);

-- Insert system default context template for Göteborgsregionen
INSERT INTO public.context_templates (
  title,
  description,
  context_data,
  is_system_default,
  created_by,
  is_active
)
VALUES (
  'Göteborgsregionen - Systemstandard',
  'Strategisk kontext för Göteborgsregionens vision, prioriteringar och fokusområden',
  '{
    "organization_context": {
      "name": "Göteborgsregionen",
      "vision": "En ledande och hållbar storstadsregion med stark konkurrenskraft, hög livskvalitet och global attraktionskraft",
      "strategic_goals": [
        "Hållbar tillväxt och utveckling",
        "Klimatneutralitet och cirkulär ekonomi",
        "Social sammanhållning och jämlikhet",
        "Innovation och digitalisering",
        "Regional samverkan och styrning"
      ],
      "focus_areas": [
        "Hållbar infrastruktur och mobilitet",
        "Näringslivsutveckling och kompetensförsörjning",
        "Bostadsförsörjning och stadsutveckling",
        "Kultur, utbildning och folkhälsa",
        "Klimatomställning och miljö"
      ]
    },
    "analysis_guidelines": {
      "key_aspects": [
        "Regional påverkan och synergier mellan kommuner",
        "Koppling till regionala utvecklingsstrategier",
        "Hållbarhetsperspektiv (ekonomiskt, socialt, ekologiskt)",
        "Implementerbarhet och resurseffektivitet",
        "Innovationspotential och skalbarhet"
      ],
      "evaluation_criteria": [
        "Strategisk relevans för regionens långsiktiga utveckling",
        "Bidrag till klimatmål och miljömål",
        "Potential för samverkan och gemensamma resurser",
        "Överensstämmelse med nationella och EU-direktiv",
        "Effekter på regional attraktivitet och konkurrenskraft"
      ]
    },
    "reference_framework": {
      "key_terms": {
        "BRP": "Bruttonationalprodukt - mått på regional ekonomisk aktivitet",
        "K2025": "Strategi för Göteborg 2035",
        "RUP": "Regional utvecklingsplan",
        "GSHP": "Göteborgsregionens strukturbild",
        "VGR": "Västra Götalandsregionen"
      },
      "strategic_documents": [
        "Regional utvecklingsstrategi för Västsverige",
        "Klimat 2030 - handlingsplan",
        "Regional kompetensförsörjningsstrategi",
        "Regional trafikförsörjningsplan"
      ]
    },
    "custom_instructions": {
      "tone": "Professionell, objektiv och strategiskt inriktad",
      "language": "Svenska, med tydlig och koncis formulering",
      "structure": "Strukturerad analys med tydliga rubriker och punktlistor",
      "focus": "Evidensbaserad analys med konkreta exempel och rekommendationer"
    }
  }'::jsonb,
  true,
  'd24e11f8-ab13-419c-b4ce-449c79d18fe0'::uuid,
  true
);