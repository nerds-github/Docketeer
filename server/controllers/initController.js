/**
 * @module initDatabase Controller
 * @description Contains middleware that creates and runs the local database
 */

const db = require('../models/psqlQuery');
const path = require('path')
const { exec } = require('child_process')


const initController = {};

initController.initDatabase = (req, res, next) => {
  const directory =
    process.env.NODE_ENV === 'development'
      ? path.resolve(__dirname, '../../src/database')
      : path.join(path.dirname(__dirname), 'database');

  exec(
    `cd ${directory} && docker compose up --no-recreate --wait -d`,
    (error, stdout, stderr) => {
      res.locals.error = error;
      res.locals.stderr = stderr;
      res.locals.stdout = stdout;
      return next();
    }
  );
};


initController.timeZone = (req, res, next) => {
  const parameter = [req.body.timezone.toString()]
  console.log(parameter)
  //!Abigail... why can't I do the $1 thing? Does it only work if you have more than one?
  db.query2(`set time zone 7`)
    .then((data) => {
      console.log(data)
      return next();
    })
    .catch((err) => {
      console.log(err)
      if (err) return next(err);
    });
};


//This query gets invoked on line 420 of LineChartDisplay but unsure of when it runs.
  //Can't get it to console log and need to figure out what it needs to return. At first glance, looks like just the query response
initController.gitURL = (req, res, next) => {
  console.log('req.body: ', req.body)
  const parameter = Object.keys(req.body.githubUrl)[0]
  console.log('parameter: ', parameter)
  //there is currently nothing in the table....so need to populate it first to see if queries work
  db.query2(`SELECT * FROM containers`)
  .then((data) => {
    console.log(`container table data: `, data)
    res.locals.data = data;
    return next();
  })
  //pretty sure I need to use the $1 and parameters array, but can't find out how to invoke this yet
  // db.query2(`SELECT github_url FROM containers where name = '${parameter}'`)
  //   .then((data) => {
  //     console.log(data)
  //     return next();
  //   })
  //   .catch((err) => {
  //     console.log(err)
  //     if (err) return next(err);
  //   });
}


//inserting the metrics pulled from the running containers and stopped containers from Docker into the Database
initController.addMetrics = (req, res, next) => {
  console.log(req.body);
  //body comes back with container names as the keys, each key is an object filled with the container data
  const containers = Object.keys(req.body.containers);
  //query string to insert the metric data into the table.
  const queryString = `INSERT INTO metrics (container_id, container_name, cpu_pct, memory_pct, memory_usage, net_io, block_io, pid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
  //need to run 1 query per objects on the req.body
    //doens't need to be async because we don't return anyhting?
  containers.forEach((container) => {
    console.log('Container Name: ', req.body.containers[container])
    //object deconstructing for each of the containers to pass them in as parameters for the query
    const { ID, names, cpu, mem, memuse, net, block, pid } = req.body.containers[container]
    const parameters = [ ID, names, cpu, mem, memuse, net, block, pid ]
    //querying the database with the string and parameters. Don't need to return anything
    db.query2(queryString, parameters)
    .then(() => {
      console.log('Insertion successful')
    })
    .catch((err) => {
      console.log(err)
      if (err) return next(err);
    });
  })
  return next();
}

initController.getMetrics = async (req, res, next) => {
  let queryString = 'SELECT * FROM metrics WHERE (container_name = $1 ';
  const queryStringEnd = `AND created_at >= now() - interval '4 hour' ORDER BY "created_at" ASC`
  const containerList = req.body.containers
  console.log('ContainerList: ', containerList);
  console.log('ContainerList Length: ', containerList.length)
  //if only one checkbox is clicked, this will run
  if (containerList.length === 1) {
    queryString += ')' + queryStringEnd;
    await db.query2(queryString, containerList)
    .then((data) => {
      console.log('getMetrics Container: ', data);
      res.locals.metrics = data;
      return next();
    })
  }
  //if there are more than one containers selected, this will activate
  else { 
    containerList.slice(1).forEach((idx) => {
      let additionalParameter = `OR container_name = $${idx + 2} `;
      if (idx === containerList.length - 2) additionalParameter += ')';
      queryString += additionalParameter;
    });
    queryString += queryStringEnd;
    await db.query2(queryString, containerList)
    .then((data) => {
      console.log('GetMetrics Container: ', data);
      res.locals.metrics = data;
      return next();
    })
  }
}

module.exports = initController;