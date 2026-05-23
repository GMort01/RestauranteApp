// src/services/aiService.ts
import { MenuItem, AIPreferences } from '../types';
import { fetchMenuItems, fetchRestaurants, analyzeIntent } from './apiService';

const searchSynonymsMap: Record<string, string[]> = {
  hamburguesa: ['burger', 'hamburguesa', 'hamburguesas'],
  burger: ['burger', 'hamburguesa', 'hamburguesas'],
  combo: ['combo', 'menu', 'menú', 'promocion', 'promoción'],
  menu: ['combo', 'menu', 'menú', 'promocion', 'promoción'],
  snack: ['snack', 'aperitivo', 'antojito', 'botana'],
  antojo: ['antojo', 'craving', 'snack', 'botana'],
  rapido: ['rapido', 'rápido', 'fast', 'express', 'sencillo'],
  saludable: ['saludable', 'fit', 'ligero', 'light', 'balanceado'],
  pizza: ['pizza', 'pizzeria', 'pizzas'],
  pasta: ['pasta', 'spaghetti', 'spaguetti', 'fideos'],
  pollo: ['pollo', 'pechuga', 'grill', 'asado'],
  pescado: ['pescado', 'mariscos', 'sushi', 'ceviche', 'atun', 'salmon'],
  mariscos: ['mariscos', 'pescado', 'sushi', 'ceviche', 'camarones'],
  sushi: ['sushi', 'roll', 'pescado', 'salmon', 'atun'],
  ceviche: ['ceviche', 'pescado', 'mariscos', 'limon'],
  barato: ['barato', 'economico', 'promo', 'promocion', 'combo'],
  economico: ['economico', 'barato', 'promo', 'combo'],
  rico: ['rico', 'sabroso', 'delicioso'],
};

// Usa Gemini para enriquecer búsquedas de lenguaje natural (>3 palabras).
// Si Gemini falla, cae silenciosamente al filtro local original.
async function enrichWithGemini(preferences: AIPreferences): Promise<AIPreferences> {
  const search = preferences.search ?? '';
  const wordCount = search.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) return preferences; // Búsquedas cortas no necesitan IA

  try {
    const result = await analyzeIntent(search);
    return {
      search: result.search || search,
      dietType: preferences.dietType || result.dietType,
      allergies:
        (preferences.allergies ?? []).length > 0
          ? preferences.allergies
          : result.allergies,
    };
  } catch {
    // Fallback silencioso: si Gemini falla, usa preferencias originales.
    return preferences;
  }
}

const allergyKeywordsMap: Record<string, string[]> = {
  gluten: ['pizza', 'tortilla', 'burrito', 'wrap', 'brownie', 'tarta', 'galleta', 'pan', 'tempura', 'ramen', 'sushi', 'roll', 'fajitas', 'cheesecake', 'tiramisu', 'masa', 'crouton', 'galletas', 'pastel'],
  lacteos: ['queso', 'leche', 'mascarpone', 'parmesano', 'mozzarella', 'cheddar', 'crema', 'helado', 'yogur', 'mantequilla', 'manteca', 'cheesecake', 'tiramisu', 'brownie'],
  huevo: ['huevo', 'tiramisu', 'omelet', 'mayonesa', 'caesar', 'ramen', 'brownie', 'aliño'],
  mariscos: ['camarón', 'mariscos', 'langostinos', 'mejillones', 'almejas', 'paella', 'ceviche', 'camarones'],
  pescado: ['salmón', 'atún', 'pescado', 'sashimi', 'ceviche'],
  soya: ['soja', 'miso', 'edamame', 'tamarindo', 'tamari', 'salsa de soya', 'soy', 'aderezo', 'soya'],
  mani: ['cacahuete', 'maní', 'cacahuates', 'peanut'],
  nueces: ['almendra', 'nuez', 'nueces', 'avellana', 'pistacho'],
};

const normalizeText = (text: string): string =>
  // Normaliza acentos para mejorar coincidencias en español.
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const tokenizeText = (text: string): string[] =>
  normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);

const normalizeSearchTokens = (text: string): string[] => {
  const tokens = tokenizeText(text);
  const expandedTokens = new Set<string>(tokens);

  for (const token of tokens) {
    const aliases = searchSynonymsMap[token];
    if (!aliases) continue;

    for (const alias of aliases) {
      expandedTokens.add(normalizeText(alias));
    }
  }

  return [...expandedTokens];
};

const buildQueryVariantsFromCatalog = (search: string, catalogTokens: string[]): string[] => {
  const base = search.trim();
  if (!base) return [];

  const baseTokens = normalizeSearchTokens(base);
  const variants = new Set<string>([base]);

  for (const token of baseTokens) {
    const similarCatalogTokens = catalogTokens
      .map((catalogToken) => ({
        token: catalogToken,
        score: tokenSimilarity(token, catalogToken),
      }))
      .filter((entry) => entry.score >= 0.68)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.token);

    if (similarCatalogTokens.length > 0) {
      variants.add(`${base} ${similarCatalogTokens.join(' ')}`);
    }
  }

  return [...variants];
};

const buildCatalogTokens = (items: MenuItem[]): string[] => {
  const tokenSet = new Set<string>();

  for (const item of items) {
    tokenizeText(item.nombre).forEach((token) => tokenSet.add(token));
    tokenizeText(item.categoria).forEach((token) => tokenSet.add(token));
    tokenizeText(item.descripcion).forEach((token) => tokenSet.add(token));
    tokenizeText(item.restaurantName || '').forEach((token) => tokenSet.add(token));
    (item.tags || []).forEach((tag) => tokenizeText(tag).forEach((token) => tokenSet.add(token)));
  }

  return [...tokenSet];
};

const scoreSoftSemanticMatch = (item: MenuItem, query: string): number => {
  const queryTokens = normalizeSearchTokens(query);
  if (queryTokens.length === 0) return 0;

  const itemTokens = new Set<string>([
    ...tokenizeText(item.nombre),
    ...tokenizeText(item.categoria),
    ...tokenizeText(item.descripcion),
    ...tokenizeText(item.restaurantName || ''),
    ...(item.tags || []).flatMap((tag) => tokenizeText(tag)),
  ]);

  if (itemTokens.size === 0) return 0;

  let score = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    itemTokens.forEach((itemToken) => {
      const current = tokenSimilarity(queryToken, itemToken);
      if (current > best) best = current;
    });
    score += best;
  }

  return score;
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost
      );
    }
  }

  return matrix[a.length][b.length];
};

const tokenSimilarity = (queryToken: string, candidateToken: string): number => {
  if (!queryToken || !candidateToken) return 0;
  if (queryToken === candidateToken) return 1;

  if (
    queryToken.length >= 4 &&
    candidateToken.length >= 4 &&
    (queryToken.startsWith(candidateToken) || candidateToken.startsWith(queryToken))
  ) {
    return 0.85;
  }

  const distance = levenshteinDistance(queryToken, candidateToken);
  const maxLen = Math.max(queryToken.length, candidateToken.length);
  if (distance === 1) return 0.82;
  if (distance === 2 && maxLen >= 6) return 0.68;

  return 0;
};

const scoreFuzzyMatch = (corpus: string, search: string): number => {
  const normalizedCorpus = normalizeText(corpus);
  const corpusTokens = tokenizeText(normalizedCorpus);
  const queryTokens = normalizeSearchTokens(search);

  if (queryTokens.length === 0 || corpusTokens.length === 0) return 0;

  let score = 0;
  for (const queryToken of queryTokens) {
    let bestTokenScore = 0;

    for (const corpusToken of corpusTokens) {
      const current = tokenSimilarity(queryToken, corpusToken);
      if (current > bestTokenScore) {
        bestTokenScore = current;
      }
      if (bestTokenScore >= 1) break;
    }

    score += bestTokenScore;
  }

  // Penaliza coincidencias débiles globales para evitar recomendaciones absurdas.
  const avgScore = score / queryTokens.length;
  const dynamicThreshold = queryTokens.length >= 3 ? 0.35 : 0.45;
  return avgScore >= dynamicThreshold ? score : 0;
};

const scoreItemForQuery = (item: MenuItem, query: string): number => {
  if (!query.trim()) return 0;

  const nameScore = scoreFuzzyMatch(item.nombre, query) * 2.2;
  const categoryScore = scoreFuzzyMatch(item.categoria, query) * 1.3;
  const descriptionScore = scoreFuzzyMatch(item.descripcion, query) * 1.1;
  const restaurantScore = scoreFuzzyMatch(item.restaurantName || '', query) * 0.9;
  const tagsScore = (item.tags || []).reduce((acc, tag) => acc + scoreFuzzyMatch(tag, query), 0) * 1.25;

  return nameScore + categoryScore + descriptionScore + restaurantScore + tagsScore;
};

const corpusMatchesSearch = (corpus: string, search: string): boolean => {
  const normalizedCorpus = normalizeText(corpus);
  const searchVariants = normalizeSearchTokens(search);

  return searchVariants.some((variant) => normalizedCorpus.includes(variant));
};

const scoreSearchMatch = (corpus: string, search: string): number => {
  const normalizedCorpus = normalizeText(corpus);
  const searchTokens = normalizeSearchTokens(search);
  let score = 0;

  for (const token of searchTokens) {
    if (normalizedCorpus.includes(token)) {
      score += token.length >= 6 ? 3 : 2;
    } else if (token.length >= 4 && normalizedCorpus.includes(token.slice(0, 4))) {
      score += 1;
    }
  }

  return score;
};

const toMenuItemWithRestaurantMeta = (
  plato: MenuItem,
  allRestaurants: { id: string; nombre: string; rating: number; entrega: string }[]
): MenuItem => {
  // Enriquecer items con metadata del restaurante mejora UX en tarjetas.
  const restaurante = allRestaurants.find((r) => r.id === plato.restaurantId);
  return {
    ...plato,
    restaurantName: restaurante ? restaurante.nombre : plato.restaurantName,
    restaurantRating: restaurante ? restaurante.rating : 'N/A',
    deliveryTime: restaurante ? restaurante.entrega : plato.deliveryTime,
  };
};

export const getAIRecommendations = async (preferences: AIPreferences): Promise<MenuItem[]> => {
  const enriched = await enrichWithGemini(preferences);
  const [allMenuItems, allRestaurants] = await Promise.all([
    fetchMenuItems(),
    fetchRestaurants(),
  ]);
  const catalogTokens = buildCatalogTokens(allMenuItems);

  let results: MenuItem[] = [...allMenuItems];

  const dietType = enriched.dietType || 'carnivoro';
  if (dietType === 'vegano') {
    results = results.filter((item) => item.isVegan === true);
  } else if (dietType === 'vegetariano') {
    results = results.filter(
      (item) =>
        item.isVegan === true ||
        (item.tags &&
          item.tags.some(
            (tag) =>
              tag.toLowerCase().includes('vegetariana') ||
              tag.toLowerCase().includes('vegana') ||
              tag.toLowerCase().includes('vegano')
          ))
    );
  }

  const allergies = (enriched.allergies || [])
    .map((allergy) => allergy.trim().toLowerCase())
    .filter(Boolean);

  if (allergies.length > 0) {
    // Filtro preventivo por alergias usando aliases de palabras comunes.
    results = results.filter((item) => {
      const itemText = normalizeText([item.nombre, item.descripcion, ...(item.tags || [])].join(' '));
      return !allergies.some((allergy) => {
        const normalizedAllergy = normalizeText(allergy).replace(/\s+/g, '');
        const aliases = allergyKeywordsMap[normalizedAllergy] || [normalizedAllergy];
        return aliases.some((keyword) => itemText.includes(keyword));
      });
    });
  }

  if (enriched.search) {
    const query = enriched.search.trim();
    const queryVariants = buildQueryVariantsFromCatalog(query, catalogTokens);
    const strictMatches = results.filter((item) =>
      queryVariants.some(
        (variant) =>
          corpusMatchesSearch(item.nombre, variant) ||
          corpusMatchesSearch(item.categoria, variant) ||
          corpusMatchesSearch(item.descripcion, variant) ||
          corpusMatchesSearch(item.restaurantName || '', variant) ||
          (item.tags && item.tags.some((tag) => corpusMatchesSearch(tag, variant)))
      )
    );

    if (strictMatches.length > 0) {
      results = strictMatches;
    } else {
      // Si no hay match exacto, se usa ranking difuso para sugerir lo más cercano.
      const fuzzyRanked = results
        .map((item) => ({
          item,
          score: Math.max(...queryVariants.map((variant) => scoreItemForQuery(item, variant))),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((entry) => entry.item);

      if (fuzzyRanked.length > 0) {
        results = fuzzyRanked;
      } else {
        // Fallback general: busca afinidad semántica suave en todo el catálogo filtrado.
        const semanticFallback = results
          .map((item) => ({
            item,
            score: Math.max(...queryVariants.map((variant) => scoreSoftSemanticMatch(item, variant))),
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map((entry) => entry.item);

        if (semanticFallback.length > 0) {
          results = semanticFallback;
        } else {
          // Último recurso general para cliente indeciso: top populares y económicos.
          results = [...results]
            .sort((a, b) => {
              const popularityDelta = Number(Boolean(b.popular)) - Number(Boolean(a.popular));
              if (popularityDelta !== 0) return popularityDelta;
              return a.precio - b.precio;
            })
            .slice(0, 10);
        }
      }
    }
  }

  return results.map((plato) => toMenuItemWithRestaurantMeta(plato, allRestaurants));
};

export const getNearbyRecommendations = async (
  preferences: AIPreferences,
  maxResults = 6
): Promise<MenuItem[]> => {
  // Fallback: si no hay match exacto, rankea por similitud textual.
  const enriched = await enrichWithGemini(preferences);
  const [allMenuItems, allRestaurants] = await Promise.all([fetchMenuItems(), fetchRestaurants()]);

  let candidates: MenuItem[] = [...allMenuItems];

  const dietType = enriched.dietType || 'carnivoro';
  if (dietType === 'vegano') {
    candidates = candidates.filter((item) => item.isVegan === true);
  } else if (dietType === 'vegetariano') {
    candidates = candidates.filter(
      (item) =>
        item.isVegan === true ||
        (item.tags &&
          item.tags.some(
            (tag) =>
              normalizeText(tag).includes('vegetar') || normalizeText(tag).includes('vegan')
          ))
    );
  }

  const allergies = (enriched.allergies || [])
    .map((allergy) => normalizeText(allergy).replace(/\s+/g, ''))
    .filter(Boolean);

  if (allergies.length > 0) {
    candidates = candidates.filter((item) => {
      const itemText = normalizeText([item.nombre, item.descripcion, ...(item.tags || [])].join(' '));
      return !allergies.some((allergy) => {
        const aliases = allergyKeywordsMap[allergy] || [allergy];
        return aliases.some((keyword) => itemText.includes(keyword));
      });
    });
  }

  const queryTokens = tokenizeText(enriched.search || '');
  if (queryTokens.length === 0) {
    return candidates.slice(0, maxResults).map((item) => toMenuItemWithRestaurantMeta(item, allRestaurants));
  }

  const queryVariants = buildQueryVariantsFromCatalog(enriched.search || '', buildCatalogTokens(candidates));

  const scored = candidates
    .map((item) => {
      const restaurantName =
        allRestaurants.find((restaurant) => restaurant.id === item.restaurantId)?.nombre ||
        item.restaurantName ||
        '';
      const corpus = normalizeText(
        [item.nombre, item.categoria, item.descripcion, restaurantName, ...(item.tags || [])].join(' ')
      );
      let score = Math.max(...queryVariants.map((variant) => scoreSearchMatch(corpus, variant)));
      score += Math.max(...queryVariants.map((variant) => scoreItemForQuery(item, variant))) * 1.4;

      if (queryTokens.length > 0 && normalizeText(item.nombre).includes(queryTokens[0])) {
        score += 2;
      }

      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((entry) => toMenuItemWithRestaurantMeta(entry.item, allRestaurants));

  if (scored.length > 0) return scored;

  const softSemantic = candidates
    .map((item) => ({
      item,
      score: Math.max(...queryVariants.map((variant) => scoreSoftSemanticMatch(item, variant))),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((entry) => toMenuItemWithRestaurantMeta(entry.item, allRestaurants));

  if (softSemantic.length > 0) return softSemantic;

  return [...candidates]
    .sort((a, b) => {
      const popularityDelta = Number(Boolean(b.popular)) - Number(Boolean(a.popular));
      if (popularityDelta !== 0) return popularityDelta;
      return a.precio - b.precio;
    })
    .slice(0, maxResults)
    .map((item) => toMenuItemWithRestaurantMeta(item, allRestaurants));
};
