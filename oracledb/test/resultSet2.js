/* Copyright (c) 2015, Oracle and/or its affiliates. All rights reserved. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * The node-oracledb test suite uses 'mocha', 'should' and 'async'. 
 * See LICENSE.md for relevant licenses.
 *
 * NAME
 *   55. resultSet2.js
 *
 * DESCRIPTION
 *   Testing driver resultSet feature.
 *
 * NUMBERING RULE
 *   Test numbers follow this numbering rule:
 *     1  - 20  are reserved for basic functional tests
 *     21 - 50  are reserved for data type supporting tests
 *     51 onwards are for other tests 
 * 
 *****************************************************************************/
 "use strict";

var oracledb = require('oracledb');
var should = require('should');
var async = require('async');
var dbConfig = require('./dbConfig.js');

describe('55. resultSet2.js', function() {

  if(dbConfig.externalAuth){
    var credential = { externalAuth: true, connectString: dbConfig.connectString };
  } else {
    var credential = dbConfig;
  }
 
  var connection = false;
  var createTable = 
      "BEGIN \
          DECLARE \
              e_table_exists EXCEPTION; \
              PRAGMA EXCEPTION_INIT(e_table_exists, -00942); \
          BEGIN \
              EXECUTE IMMEDIATE ('DROP TABLE oracledb_employees'); \
          EXCEPTION \
              WHEN e_table_exists \
              THEN NULL; \
          END; \
          EXECUTE IMMEDIATE (' \
              CREATE TABLE oracledb_employees ( \
                  employees_id NUMBER,  \
                  employees_name VARCHAR2(20) \
              ) \
          '); \
      END; ";
      
  var rowsAmount = 300;    
  var insertRows = 
      "DECLARE \
          x NUMBER := 0; \
          n VARCHAR2(20); \
       BEGIN \
          FOR i IN 1..300 LOOP \
             x := x + 1; \
             n := 'staff ' || x; \
             INSERT INTO oracledb_employees VALUES (x, n); \
          END LOOP; \
       END; ";
       
  var proc = 
      "CREATE OR REPLACE PROCEDURE get_emp_rs (p_in IN NUMBER, p_out OUT SYS_REFCURSOR) \
         AS \
         BEGIN \
           OPEN p_out FOR  \
             SELECT * FROM oracledb_employees \
             WHERE employees_id > p_in; \
         END; "; 

  beforeEach(function(done) {
    async.series([
      function(callback) {
        oracledb.getConnection(
          credential,
          function(err, conn) {
            connection = conn;
            callback();
          }
        );
      },
      function(callback) {
        connection.should.be.ok;
        connection.execute(
          createTable,
          function(err) {
            should.not.exist(err);
            callback();
          }
        );
      },
      function(callback) {
        connection.execute(
          insertRows,
          [],
          { autoCommit: true },
          function(err) {
            should.not.exist(err);
            callback();
          }
        );
      },
      function(callback) {
        connection.execute(
          proc,
          [],
          { autoCommit: true },
          function(err) {
            should.not.exist(err);
            callback();
          }
        );
      }
    ], done);
  })
  
  afterEach(function(done) {
    async.series([
      function(callback) {
        connection.execute(
          'DROP TABLE oracledb_employees',
          function(err) {
            should.not.exist(err);
            callback();
          }
        );
      },
      function(callback) {
        connection.execute(
          'DROP PROCEDURE get_emp_rs',
          function(err) {
            should.not.exist(err);
            callback();
          }
        );
      },
      function(callback) {
        connection.release( function(err) {
          should.not.exist(err);
          callback();
        });
      }
    ], done);
  })
  
  describe('55.1 query a RDBMS function', function() {
    it('55.1.1 LPAD function', function(done) {
      connection.should.be.ok;
      connection.execute(
        "select lpad('a',100,'x') from dual",
        [],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          fetchRowFromRS(result.resultSet);
        }
      );
      
      function fetchRowFromRS(rs) {
        rs.getRow(function(err, row) {
          should.not.exist(err);
          if(row) {
            // console.log(row);
            row[0].length.should.be.exactly(100);
            return fetchRowFromRS(rs);
          } else {
            rs.close(function(err) {
              should.not.exist(err);
              done();
            });
          }
        });
      }
    })
  })
  
  describe('55.2 binding variables', function() {   
    it('55.2.1 query with one binding variable', function(done) {
      connection.should.be.ok;
      var rowCount = 0;
      connection.execute(
        "SELECT * FROM oracledb_employees WHERE employees_id > :1",
        [200],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          // console.log(result.resultSet);
          fetchRowFromRS(result.resultSet);
        } 
      );
      
      function fetchRowFromRS(rs) {
        rs.getRow(function(err, row) {
          should.not.exist(err);
          if(row) {
            rowCount++;
            return fetchRowFromRS(rs);
          } else {
            rs.close(function(err) {
              rowCount.should.be.exactly(100);
              should.not.exist(err);
              done();
            });
          }
        });
      }
    })
    
  })
  
  describe('55.3 alternating getRow() & getRows() function', function() {
    it('55.3.1 result set', function(done) {
      connection.should.be.ok;
      var accessCount = 0;
      var numRows = 4;
      var flag = 1; // 1 - getRow(); 2 - getRows(); 3 - to close resultSet.
      connection.execute(
        "SELECT * FROM oracledb_employees WHERE employees_id > :1",
        [200],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          // console.log(result.resultSet);
          fetchRowFromRS(result.resultSet);
        } 
      );
      
      function fetchRowFromRS(rs) {
        if(flag === 1) {
          rs.getRow(function(err, row) {
            should.not.exist(err);
            if(row) {
              flag = 2;
              accessCount++;
              return fetchRowFromRS(rs);
            } else {
              flag = 3;
              return fetchRowFromRS(rs);
            }
          });
        }
        else if(flag === 2) {
          rs.getRows(numRows, function(err, rows) {
            should.not.exist(err);
            if(rows.length > 0) {
              flag = 1;
              accessCount++;
              return fetchRowFromRS(rs);
            } else {
              flag = 3;
              return fetchRowFromRS(rs);
            }
          });
        }
        else if(flag === 3) {
          // console.log("resultSet is empty!");
          rs.close(function(err) {
            should.not.exist(err);
            // console.log("Total access count is " + accessCount);
            accessCount.should.be.exactly((100/(numRows + 1)) * 2);
            done();
          });
        }       
      }
    })
    
    it('55.3.2 REF Cursor', function(done) {
      connection.should.be.ok;
      var accessCount = 0;
      var numRows = 4;
      var flag = 1; // 1 - getRow(); 2 - getRows(); 3 - to close resultSet.
      
      connection.execute(
        "BEGIN get_emp_rs(:in, :out); END;",
        {
          in: 200,
          out: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        },
        function(err, result) {
          should.not.exist(err);
          fetchRowFromRS(result.outBinds.out, done);
        }
      );
      
      function fetchRowFromRS(rs, cb) {
        if(flag === 1) {
          rs.getRow(function(err, row) {
            should.not.exist(err);
            if(row) {
              flag = 2;
              accessCount++;
              return fetchRowFromRS(rs, cb);
            } else {
              flag = 3;
              return fetchRowFromRS(rs, cb);
            }
          });
        }
        else if(flag === 2) {
          rs.getRows(numRows, function(err, rows) {
            should.not.exist(err);
            if(rows.length > 0) {
              flag = 1;
              accessCount++;
              return fetchRowFromRS(rs, cb);
            } else {
              flag = 3;
              return fetchRowFromRS(rs, cb);
            }
          });
        }
        else if(flag === 3) {
          // console.log("resultSet is empty!");
          rs.close(function(err) {
            should.not.exist(err);
            // console.log("Total access count is " + accessCount);
            accessCount.should.be.exactly((100/(numRows + 1)) * 2);
            cb();
          });
        }       
      }
    })
  })
  
  describe('55.4 release connection before close resultSet', function() {
    var conn2 = false;
    function fetchRowFromRS(rs, cb) {
      rs.getRow(function(err, row) {
        if(row) {
          return fetchRowFromRS(rs, cb);
        } else {
          conn2.release(function(err) {
            should.not.exist(err);
            rs.close(function(err) {
              should.exist(err);
              err.message.should.startWith('NJS-003'); // invalid connection
              cb();
            });
          });
        }
      });
    }
    
    beforeEach(function(done) {
      oracledb.getConnection(
        credential, 
        function(err, conn) {
          should.not.exist(err);
          conn2 = conn;
          done();
        }
      );
    })
    
    it('55.4.1 result set', function(done) {
      conn2.should.be.ok;
      conn2.execute(
        "SELECT * FROM oracledb_employees",
        [],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          fetchRowFromRS(result.resultSet, done);
        }
      );
    })
    
    it('55.4.2 REF Cursor', function(done) {
      conn2.should.be.ok;
      
      conn2.execute(
        "BEGIN get_emp_rs(:in, :out); END;",
        {
          in: 200,
          out: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        },
        function(err, result) {
          should.not.exist(err);
          fetchRowFromRS(result.outBinds.out, done);
        }
      );
    })
  })
  
  describe('55.5 the content of resultSet should be consistent', function() {
    it('55.5.1 (1) get RS (2) modify data in that table and commit (3) check RS', function(done) {
      connection.should.be.ok;
      var rowsCount = 0;
      var rs = false;
      async.series([
        function(callback) {
          connection.execute(
            "SELECT * FROM oracledb_employees",
            [],
            { resultSet: true },
            function(err, result) {
              should.not.exist(err);
              rs = result.resultSet;
              callback();
            }
          );
        },
        function(callback) {
          connection.execute(
            "TRUNCATE TABLE oracledb_employees",
            [],
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              callback();
            }
          );
        },
        function(callback) {
          fetchRowFromRS(rs, callback);
        } 
      ], done);
      
      function fetchRowFromRS(rset, cb) {
        rset.getRow(function(err, row) {
          should.not.exist(err);
          if(row) {
            rowsCount++;
            return fetchRowFromRS(rset, cb);
          } else {
            rset.close(function(err) {
              should.not.exist(err);
              rowsCount.should.eql(rowsAmount);
              cb();
            });
          }
        });
      }
      
    })

  })
  
  describe('55.6 access resultSet simultaneously', function() {
    var numRows = 10;  // number of rows to return from each call to getRows()
    
    function fetchRowFromRS(rs, cb) {
      rs.getRow(function(err, row) {
        if(err) {
          cb(err);
          return;
        } else {
          if(row) {
            return fetchRowFromRS(rs, cb);
          } else {
            cb();
          }
        } 
      });
    }
      
    function fetchRowsFromRS(rs, cb) {
      rs.getRows(numRows, function(err, rows) {
        if(err) {
          cb(err);
          return;
        } else {
          if(rows.length > 0) {
            return fetchRowsFromRS(rs, cb);
          } else {
            cb();
          }
        } 
      });
    }
    
    it('55.6.1 concurrent operations on resultSet are not allowed', function(done) {
      connection.should.be.ok;
      
      connection.execute(
        "SELECT * FROM oracledb_employees",
        [],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          async.parallel([
            function(callback) {
              fetchRowFromRS(result.resultSet, callback);
            },
            function(callback) {
              fetchRowsFromRS(result.resultSet, callback);
            }
          ], function(err) {
            if(err) {
              // console.log(err);
              err.message.should.startWith('NJS-017'); 
              result.resultSet.close(function(err) {
                done();
              });
            } else {
              result.resultSet.close(function(error) {
                should.not.exist(error);
                done();
              });
            }  
          });
        }
      );   
    })
    
    it('55.6.2 concurrent operation on REF Cursor are not allowed', function(done) {
      connection.should.be.ok;

      connection.execute(
        "BEGIN get_emp_rs(:in, :out); END;",
        {
          in: 0,
          out: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
        }, 
        function(err, result) {
          should.not.exist(err);
          async.parallel([
            function(callback) {
              fetchRowFromRS(result.outBinds.out, callback);
            },
            function(callback) {
              fetchRowsFromRS(result.outBinds.out, callback);
            }
          ], function(err) {
            if(err) {
              // console.log(err);
              err.message.should.startWith('NJS-017'); 
              result.outBinds.out.close(function(err) {
                done();
              });
            } else {
              result.outBinds.out.close(function(error) {
                should.not.exist(error);
                done();
              });
            }  
          });
        }
      );
    })
    
  })
  
  describe('55.7 getting multiple resultSets', function() {
    var numRows = 10;  // number of rows to return from each call to getRows()
    
    function fetchRowFromRS(rs, cb) {
      rs.getRow(function(err, row) {
        should.not.exist(err);
        if(row) {
          return fetchRowFromRS(rs, cb);
        } else {
          rs.close(function(err) {
            should.not.exist(err);
            cb();
          });
        }
      });
    }
      
    function fetchRowsFromRS(rs, cb) {
      rs.getRows(numRows, function(err, rows) {
        should.not.exist(err);
        if(rows.length > 0) {
          return fetchRowsFromRS(rs, cb);
        } else {
          rs.close(function(err) {
            should.not.exist(err);
            cb();
          });
        } 
      });
    }
    
    it('55.7.1 can access multiple resultSet on one connection', function(done) {
      connection.should.be.ok;
      async.parallel([
        function(callback) {
          connection.execute(
            "SELECT * FROM oracledb_employees",
            [],
            { resultSet: true },
            function(err, result) {
              should.not.exist(err);
              fetchRowFromRS(result.resultSet, callback);
            }
          );
        },
        function(callback) {
          connection.execute(
            "SELECT * FROM oracledb_employees",
            [],
            { resultSet: true },
            function(err, result) {
              should.not.exist(err);
              fetchRowsFromRS(result.resultSet, callback);
            }
          );
        }
      ], function(err) {
        should.not.exist(err);
        done();
      });
    })
    
    it('55.7.2 can access multiple REF Cursor', function(done) {
      connection.should.be.ok;
      
      async.parallel([
        function(callback) {
          connection.execute(
            "BEGIN get_emp_rs(:in, :out); END;",
            {
              in: 200,
              out: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
            }, 
            function(err, result) {
              should.not.exist(err);
              fetchRowFromRS(result.outBinds.out, callback);
            }
          );
        },
        function(callback) {
          connection.execute(
            "BEGIN get_emp_rs(:in, :out); END;",
            {
              in: 100,
              out: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
            }, 
            function(err, result) {
              should.not.exist(err);
              fetchRowsFromRS(result.outBinds.out, callback);
            }
          );
        }
      ], function(err) {
        should.not.exist(err);
        done();
      });
    })
  })
  
  describe('55.8 Negative - resultSet is only for query statement', function() {
    it('55.8.1 resultSet cannot be returned for non-query statements', function(done) {
      connection.should.be.ok;
      connection.execute(
        "UPDATE oracledb_employees SET employees_name = 'Alan' WHERE employees_id = 100",
        [],
        { resultSet: true },
        function(err, result) {
          should.exist(err);
          // console.log(err);
          err.message.should.startWith('NJS-019');
          done();
        }
      );
      
    })
  })
  
  describe('55.9 test querying a PL/SQL function', function() {
    it('55.9.1 ', function(done) {
      var proc = 
        "CREATE OR REPLACE FUNCTION testfunc RETURN VARCHAR2 \
           IS \
             emp_name VARCHAR2(20);   \
           BEGIN \
             SELECT 'Clark Kent' INTO emp_name FROM dual; \
             RETURN emp_name;  \
           END; ";
      
      async.series([
        function(callback) {
          connection.execute(
            proc,
            function(err) {
              should.not.exist(err);
              callback();
            }
          );
        },
        function(callback) {
          connection.execute(
            "SELECT testfunc FROM dual",
            [],
            { resultSet: true },
            function(err, result) {
              should.not.exist(err);
              (result.resultSet.metaData[0].name).should.eql('TESTFUNC');
              fetchRowFromRS(result.resultSet, callback);
            }
          );
        },
        function(callback) {
          connection.execute(
            "DROP FUNCTION testfunc",
            function(err, result) {
              should.not.exist(err);
              callback();
            }
          );
        }
      ], done);
      
      function fetchRowFromRS(rs, cb) {
        rs.getRow(function(err, row) {
          should.not.exist(err);
          if(row) {
            row[0].should.eql('Clark Kent');
            return fetchRowFromRS(rs, cb);
          } else {
            rs.close(function(err) {
              should.not.exist(err);
              cb();
            });
          }
        });
      }
    })
  })
  
  describe('55.10 calls getRows() once and then close RS before getting more rows', function() {
    it('55.10.1 ', function(done) {
      connection.should.be.ok;
      var numRows = 10;
      var closeRS = true;
      connection.execute(
        "SELECT * FROM oracledb_employees", 
        [],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          result.resultSet.getRows(
            numRows, 
            function(err, rows) {
              should.not.exist(err); 
              result.resultSet.close(function(err) {
                should.not.exist(err);
                fetchRowsFromRS(result.resultSet, numRows, done);
              });
            }
          );
        }
      );
      
      function fetchRowsFromRS(rs, numRows, done) {
        rs.getRows(numRows, function(err, rows) {
          should.exist(err);
          err.message.should.startWith('NJS-018:'); // invalid result set
          done();
        });
      }
    })
  })

  describe('55.11 deals with unsupported database with result set', function() {
    var sql1 = "select dummy, HEXTORAW('0123456789ABCDEF0123456789ABCDEF') from dual";
    var sql2 = "SELECT dummy, rowid FROM dual";
    
    function fetchOneRowFromRS(rs, cb) {
      rs.getRow(function(err, row) {
        /* Currently, even if the driver doesn't support certain data type 
         * the result set can still be created.
         */ 
        // Error at accessing RS
        if(err) {
          // console.error("Error at accessing RS: " + err.message); 
          // NJS-010: unsupported data type in select list
          (err.message).should.startWith('NJS-010');
          rs.close( function(err) {
            should.not.exist(err);
            cb();
          });
        } else if(row) {
          console.log(row);
          fetchOneRowFromRS(rs, cb);
        } else {
          rs.close( function(err) {
            should.not.exist(err);
            cb();
          });
        }
      });
    }

    it('55.11.1 RAW data type', function(done) {
      connection.should.be.ok;
      connection.execute(
        sql1,
        [],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          fetchOneRowFromRS(result.resultSet, done);
        }
      );       
    })

    it('55.11.2 ROWID date type', function(done) {
      connection.execute(
        sql2,
        [],
        { resultSet: true },
        function(err, result) {
          should.not.exist(err);
          fetchOneRowFromRS(result.resultSet, done);
        }
      ); 
    })
  })

})  
