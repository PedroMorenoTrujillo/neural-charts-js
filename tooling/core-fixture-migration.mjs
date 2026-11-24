/** Offline transport for immutable pre-0.1 reference fixtures, never a runtime API alias. */
export function migrateFixtureDiscriminators(value){
  if(Array.isArray(value))return value.map(migrateFixtureDiscriminators);
  if(value===null||typeof value!=='object')return value;
  if(Object.hasOwn(value,'kind')&&Object.hasOwn(value,'type'))throw Error('Ambiguous fixture discriminator');
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key==='kind'?'type':key,migrateFixtureDiscriminators(item)]));
}
export function migrateRecipeDiscriminators(recipe){return {...recipe,data:migrateFixtureDiscriminators(recipe.data),options:migrateFixtureDiscriminators(recipe.options)};}
