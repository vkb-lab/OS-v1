# Calito — Casa da Limpeza

Aplicação web instalável (PWA) criada a partir dos dois protótipos Stitch enviados:

- o primeiro pacote forneceu a experiência de chat;
- o segundo forneceu a ideia de administração da memória.

## O que foi aperfeiçoado

- interface única e responsiva;
- chat funcional com motor local de recuperação de memória;
- respostas baseadas na memória institucional da Casa da Limpeza;
- importação local de JSON, TXT e Markdown;
- inclusão e exclusão de conhecimentos no aparelho;
- histórico local e exportação;
- separação entre memória pública e memória interna importada;
- PWA instalável e funcionamento offline após o primeiro acesso;
- nenhuma chave ou dado interno publicado no código.

## Limite da versão publicada

A versão hospedada usa um motor local de busca e composição de respostas. Ela não chama um modelo generativo externo por padrão. Para ativar uma IA generativa, configure um endpoint seguro; nunca coloque chaves de API diretamente no navegador.

## Segurança

A publicação contém apenas memória institucional segura. O arquivo completo de memória, dados financeiros, venda e outros registros internos não são publicados. Eles podem ser importados manualmente e ficam no navegador do aparelho.
