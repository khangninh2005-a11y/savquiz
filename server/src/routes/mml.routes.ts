import { FastifyInstance } from 'fastify';
// @ts-ignore
import mathjax from 'mathjax';

let MathJaxInstance: any = null;
let sizeSVG: string[] = ['1', '1', '0'];
const ratio = 7.1561;

// Initialize MathJax
mathjax
  .init({
    loader: { load: ['input/tex', 'input/mml', 'output/svg'] },
  })
  .then((mj: any) => {
    MathJaxInstance = mj;
    console.log('MathJax engine loaded in Fastify for Wiris formula rendering');
  })
  .catch((err: any) => console.error('MathJax init error:', err));

function getSize(t: string): string[] {
  const firstH = t.indexOf('height="');
  const lastH = t.indexOf('ex"', firstH + 8);
  const height = firstH >= 0 && lastH >= 0 ? t.substring(firstH + 8, lastH) : '1';

  const firstW = t.indexOf('width="');
  const lastW = t.indexOf('ex"', firstW + 7);
  const width = firstW >= 0 && lastW >= 0 ? t.substring(firstW + 7, lastW) : '1';

  const firstB = t.indexOf('vertical-align: -');
  const lastB = t.indexOf('ex', firstB + 17);
  const baseline = firstB >= 0 && lastB >= 0 ? t.substring(firstB + 17, lastB) : '0';

  return [height, width, baseline];
}

function formatType(input: string): 'mml' | 'latex' {
  const mmlStag = new RegExp('<([A-Za-z_]+:)?math', 'm');
  return input.match(mmlStag) ? 'mml' : 'latex';
}

function renderMml2Svg(input: string): string {
  if (!MathJaxInstance) return input;
  const cleanInput = input.replaceAll('\n', '').replaceAll('\r', '');
  let svg: any;
  if (formatType(cleanInput) === 'mml') {
    svg = MathJaxInstance.mathml2svg(cleanInput);
  } else {
    svg = MathJaxInstance.tex2svg(cleanInput);
  }
  let svgStr = MathJaxInstance.startup.adaptor.outerHTML(svg);
  svgStr = svgStr.replace('<mjx-container class="MathJax" jax="SVG">', '');
  svgStr = svgStr.replace('<mjx-container class="MathJax" jax="SVG" display="true">', '');
  svgStr = svgStr.replace('</mjx-container>', '');

  const s = getSize(svgStr);
  sizeSVG = s;

  const hNum = parseFloat(s[0]) || 1;
  const wNum = parseFloat(s[1]) || 1;
  const bNum = parseFloat(s[2]) || 0;

  svgStr = svgStr.replace(`${s[0]}ex`, String(hNum * ratio));
  svgStr = svgStr.replace(`${s[1]}ex`, String(wNum * ratio));
  svgStr = svgStr.replace('style=', `wrs:baseline="${(hNum - bNum) * ratio}" style=`);
  svgStr = svgStr.replace('height=', 'xmlns:wrs="http://www.wiris.com/xml/cvs-extension" height=');
  return svgStr;
}

export async function mmlRoutes(fastify: FastifyInstance) {
  // Support both GET / and POST /
  fastify.get('/', async (req, reply) => {
    const query = (req.query || {}) as Record<string, any>;
    if (query.mml) {
      reply.type('image/svg+xml');
      return reply.send(renderMml2Svg(query.mml));
    }
    return reply.send({ status: 'mml2svg ready' });
  });

  fastify.post('/', async (req, reply) => {
    const body = (req.body || {}) as Record<string, any>;
    const input = body.mml || '';
    reply.type('image/svg+xml');
    return reply.send(renderMml2Svg(input));
  });

  const handleShowImage = async (req: any, reply: any) => {
    const body = (req.body || {}) as Record<string, any>;
    const query = (req.query || {}) as Record<string, any>;
    const input = body.mml || query.mml;

    if (!input) {
      return reply.send({ status: 'warning' });
    }

    const cc = renderMml2Svg(input);
    const h = (parseFloat(sizeSVG[0]) || 1) * ratio;
    const w = (parseFloat(sizeSVG[1]) || 1) * ratio;
    const b = ((parseFloat(sizeSVG[0]) || 1) - (parseFloat(sizeSVG[2]) || 0)) * ratio;

    return reply.send({
      status: 'ok',
      result: {
        width: w,
        height: h,
        baseline: b,
        content: cc,
        format: 'svg',
        role: 'math',
      },
    });
  };

  fastify.get('/showimage', handleShowImage);
  fastify.post('/showimage', handleShowImage);
  fastify.get('//showimage', handleShowImage);
  fastify.post('//showimage', handleShowImage);

  // createimage fallback
  fastify.post('/createimage', async (req, reply) => {
    const body = (req.body || {}) as Record<string, any>;
    const input = body.mml || '';
    reply.type('image/svg+xml');
    return reply.send(renderMml2Svg(input));
  });
  fastify.get('/createimage', async (req, reply) => {
    const query = (req.query || {}) as Record<string, any>;
    const input = query.mml || '';
    reply.type('image/svg+xml');
    return reply.send(renderMml2Svg(input));
  });

  fastify.post('/mathml2content', async (req, reply) => {
    const body = (req.body || {}) as Record<string, any>;
    const input = body.input || '';
    reply.type('application/xml;charset=UTF-8');
    return reply.send(input);
  });

  fastify.post('/mathml2internal', async (req, reply) => {
    const body = (req.body || {}) as Record<string, any>;
    const input = body.mml || '<math/>';
    reply.type('application/xml;charset=UTF-8');
    return reply.send(input);
  });

  fastify.post('/tick', async (_req, reply) => {
    return reply.send('');
  });

  fastify.post('/latex2mathml', async (req, reply) => {
    const body = (req.body || {}) as Record<string, any>;
    const input = body.latex;
    if (!input || !MathJaxInstance) {
      return reply.send('input undefined');
    }
    try {
      MathJaxInstance.texReset();
      const mml = await MathJaxInstance.tex2mmlPromise(input, { display: true });
      reply.type('application/xml;charset=UTF-8');
      return reply.send(mml);
    } catch {
      reply.type('application/xml;charset=UTF-8');
      return reply.send('<math/>');
    }
  });
}
