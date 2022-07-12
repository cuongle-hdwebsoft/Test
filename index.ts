import express from 'express';
import getRank from './utils/getRank';
import FirebaseClass from './firebase/index';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.get('/api/', async (req, res) => {
  try {
    const { faculty, semester, year, k, idStudent } = req.query;

    if(!faculty || !semester || !year || !k || !idStudent) {
      return res.status(404).send({
        success: false,
        error: 'Query is not valid',
        data: null,
      });
    }
  
    // check if server has data of this query
    const fileName = `${String(faculty).toLocaleUpperCase()}_${semester}_${year}_${k}`;
    let errorCodeFirebase: string = null;
    let file = null;
    try {
      file = await FirebaseClass.getFileDataByName(`${fileName}.json`);
    } catch (error) {
      errorCodeFirebase = error.code;
    }

    if(errorCodeFirebase === 'storage/object-not-found') {
      // add item into queue to wait for admin approved
      const existence = await FirebaseClass.checkItemPointExist(fileName);

      if(existence.isExist) {
        await FirebaseClass.addItemToPointsCollection(fileName, {
          createdTime: existence.data.createdTime,
          k: k as string,
          name: fileName,
          requestedTime: existence.data.requestedTime,
          semester: semester as string,
          year: year as string,
          isApproved: false,
          isAvailable: false,
          foundCount: existence.data.foundCount+1,
          prefixId: '' // admin will update this field
        });
      } else {
        await FirebaseClass.addItemToPointsCollection(fileName, {
          createdTime: new Date().toISOString(),
          k: k as string,
          name: fileName,
          requestedTime: new Date().toISOString(),
          semester: semester as string,
          year: year as string,
          isApproved: false,
          isAvailable: false,
          foundCount: 0,
          prefixId: '' // admin will update this field
        });
      }

      return res.status(404).send({
        success: false,
        error: 'Currently, your query is not available now. But we will approve it soon. Thanks 1',
        data: null,
        query: {
          faculty,
          semester,
          year,
          k,
        }
      });
    }

    if(errorCodeFirebase) {
      throw new Error('Unknow error from firebase');
    }
  
    const result = getRank(JSON.parse(file), idStudent as unknown as string);
  
    return res.status(200).send({
      success: true,
      error: null,
      data: result,
    });
  } catch (error) {
    console.log('Error', error);

    res.status(500).send({
      success: false,
      error: 'Server internal',
      data: null
    });
  }
});

app.listen(PORT, () => {
  console.log('Server is opened port ' + PORT);
});

export default app;