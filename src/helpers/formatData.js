import { parseString } from 'xml2js';
import slugify from 'slugify';
import { firstBy } from 'thenby';
import moment from 'moment';
import mapArticleToAuthor from './mapArticleToAuthor';

function promisifiedParseString(xmlString) {
  return new Promise((resolve, reject) => {
    parseString(xmlString, { explicitArray: false }, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

async function formatData(xmlString) {
  const result = await promisifiedParseString(xmlString);
  const articles = result.feed.entry;

  const authorToArticleMapping = {};
  // { 'kelley-sharp': { name: "kelley sharp", articles: [] }}

  function mapOverAuthors(author) {
    let authors = author;
    if (!Array.isArray(author)) {
      authors = [author];
    }
    return authors;
  }

  function getArticleId(oldId) {
    const splitId = oldId.replace(/\./g, '').split('/');
    const idSuffix = splitId[splitId.length - 1];
    return idSuffix;
  }
  //only return necessary keys
  let formattedArticles = [];
  try {
    formattedArticles = articles.map(article => {
      const formattedArticle = {
        id: getArticleId(article.id),
        title: article.title,
        //leading whitespace
        summary: article.summary.trim(),
        published: article.published
      };

      //change author to authors
      formattedArticle.authors = mapOverAuthors(article.author).map(author => {
        author.id = slugify(author.name, {
          lower: true,
          remove: /[*+~.()'"!:@]/g
        });
        mapArticleToAuthor(formattedArticle, author, authorToArticleMapping);
        return author;
      });

      return formattedArticle;
    });
  } catch (error) {
    console.log({ error });
  }

  // { 'kelley-sharp': {}} -> [{ id: 'kelley-sharp', name: 'Kelley Sharp', ... }]
  const sortedAuthors = Object.keys(authorToArticleMapping)
    .map(authorId => {
      return { id: authorId, ...authorToArticleMapping[authorId] };
    })
    .sort(
      firstBy((author1, author2) => {
        if (
          moment(author1.mostRecentPublication).isAfter(
            moment(author2.mostRecentPublication)
          )
        ) {
          return -1;
        } else if (
          moment(author1.mostRecentPublication).isBefore(
            moment(author2.mostRecentPublication)
          )
        ) {
          return 1;
        } else {
          return 0;
        }
      }).thenBy((author1, author2) => {
        return author1.articles.length - author2.articles.length;
      })
    );

  return {
    articles: formattedArticles,
    authors: sortedAuthors,
    authorsObj: authorToArticleMapping
  };
}

export default formatData;
