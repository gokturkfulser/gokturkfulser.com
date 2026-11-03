// Worker giriş noktası. Giriş modülü yalnızca varsayılan işleyiciyi dışa aktarabilir (workerd, başka adlandırılmış dışa aktarmaları işleyici sanıp hata verir);
// bu yüzden mantık isleyici.ts'tedir ve testleri oradan içe aktarır.
import { isle } from './isleyici.ts';
import type { Env } from './ortam.ts';

export default {
  fetch: (istek: Request, env: Env) => isle(istek, env, { fetch: (...a: Parameters<typeof fetch>) => fetch(...a), simdi: () => Date.now() }),
};
