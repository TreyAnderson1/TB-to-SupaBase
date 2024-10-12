import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import timeout from "connect-timeout";
import debounce from "debounce";

const supabaseKey = dotenv.config(process.env.SUPABASE_KEY);
const supabaseUrl = dotenv.config(process.env.SUPABASE_URL)
const tbKey = dotenv.config(process.env.TB_KEY)
const supabase = createClient(
  supabaseUrl.parsed.SUPABASE_URL,
  supabaseKey.parsed.SUPABASE_KEY
);
const app = express();
app.use(express.json());
app.use(timeout("30s"));
async function getTransaction(id) {
  let promises = [];
  promises.push(
    await fetch(
      `https://mhg.totalbrokerage.com/api/transactions/${id}/commissions`,
      {
        method: "GET",
        headers: {
          "X-TB-API-KEY":tbKey,
          "X-TB-API-VERSION": 1,
        },
      }
    ).then((response) => response.json())
  );//gets the commissions

  promises.push(
    await fetch(`https://mhg.totalbrokerage.com/api/transactions/${id}/dates`, {
      method: "GET",
      headers: {
        "X-TB-API-KEY": tbKey,
        "X-TB-API-VERSION": 1,
      },
    }).then((response) => response.json())
  );//gets the dates

  promises.push(
    await fetch(
      `https://mhg.totalbrokerage.com/api/transactions/${id}/financials`,
      {
        method: "GET",
        headers: {
          "X-TB-API-KEY": tbKey,
          "X-TB-API-VERSION": 1,
        },
      }
    ).then((response) => response.json())
  ); //gets the financial data

  promises.push(
    await fetch(
      `https://mhg.totalbrokerage.com/api/transactions/${id}/people`,
      {
        method: "GET",
        headers: {
          "X-TB-API-KEY":tbKey,
          "X-TB-API-VERSION": 1,
        },
      }
    ).then((response) =>
      response.json().then((data) =>
        fetch(
          `https://mhg.totalbrokerage.com/api/accounts/${data.owner.account.id}`,
          {
            method: "GET",
            headers: {
              "X-TB-API-KEY": tbKey,
              "X-TB-API-VERSION": 1,
            },
          }
        ).then((response) => response.json())
      )
    )
  ); //gets the agent name

  promises.push(
    await fetch(`https://mhg.totalbrokerage.com/api/transactions/${id}`, {
      method: "GET",
      headers: {
        "X-TB-API-KEY": tbKey,
        "X-TB-API-VERSION": 1,
      },
    }).then((response) => response.json())
  ); //gets the normal transaction data


  promises.push(
    await fetch(
      `https://mhg.totalbrokerage.com/api/transactions/${id}/people`,
      {
        method: "GET",
        headers: {
          "X-TB-API-KEY": tbKey,
          "X-TB-API-VERSION": 1,
        },
      }
    ).then((response) =>
      response.json().then((data) => {
        if (data.team) {
          return fetch(
            `https://mhg.totalbrokerage.com/api/teams/${data.team.id}`,
            {
              method: "GET",
              headers: {
                "X-TB-API-KEY": tbKey,
                "X-TB-API-VERSION": 1,
              },
            }
          ).then((response) => response.json());
        } else {
          return null;
        }
      })
    )
  ); //gets the team name


  return await Promise.all(promises).then((data) => {
    return data;
  });
}

async function createTransaction(commissions, dates, financials, data, agents,team) {
  let sales_price = financials.financials.find(
    (item) => item.name == "Contract Price"
  );
  sales_price = sales_price ? sales_price.value : 0;
  let agent_first = agents ? agents.firstName : "";
  let agent_last = agents ? agents.lastName : "";
  let gross_commission =
    commissions?.baseCommission?.commissionIncome?.amount || 0;
  let brokerage_fee = commissions?.baseCommission?.netBrokerCommission || 0;
  let closed_date = dates.find((item) => item.dateType == "Closing Date");
  closed_date = closed_date ? closed_date.dateMillis : null;
  let pending_date = dates.find(
    (item) => item.dateType == "Contract Accepted Date"
  );
  let listing_start_date = dates.find(
    (item) => item.dateType == "Listing Start Date"
  );
  listing_start_date = listing_start_date
    ? listing_start_date.dateMillis
    : null;
  let listing_end_date = dates.find(
    (item) => item.dateType == "Listing End Date"
  );
  listing_end_date = listing_end_date ? listing_end_date.dateMillis : null;
  pending_date = pending_date ? pending_date.dateMillis : null;
  let status = "";
  if (data.status.name == "Closed File - ONLY CLOSING TO CHANGE THIS STATUS") {
    status = "Closed";
  }
  else if (data.status.name == "Closed - Incomplete File") {
    status = "Closed";
  }else{
    status = data.status.name;
  }

  let teamName = team ? team.name : "";
  return await supabase
    .from("total-brokerage")
    .insert([
      {
        "Transaction ID": data.id,
        "Transaction Type": data.represent,
        "Agent First Name": agent_first,
        "Agent Last Name": agent_last,
        "Sale's Price": sales_price,
        "Gross Commission Income": gross_commission,
        "Pending Date": pending_date ? new Date(pending_date) : null,
        "Closed Date": closed_date ? new Date(closed_date) : null,
        "Transaction Fee": null,
        "Team Name": teamName,
        "Listing Start Date": listing_start_date
          ? new Date(listing_start_date)
          : null,
        "Listing End Date": listing_end_date
          ? new Date(listing_end_date)
          : null,
        "Brokerage Fee": brokerage_fee,
        "status": status,
        "last_modified": new Date(),
      },
    ])
    .then((data) => {
      console.log("inside createTransaction", data.data);
      return data;
    });
}

async function updateTransaction(commissions, dates, financials, data, agents,team) {
  let sales_price = financials.financials.find(
    (item) => item.name == "Contract Price"
  );
  sales_price = sales_price ? sales_price.value : 0;
  let agent_first = agents ? agents.firstName : "";
  let agent_last = agents ? agents.lastName : "";
  let gross_commission =
    commissions?.baseCommission?.commissionIncome?.amount || 0;
  let closed_date = dates.find((item) => item.dateType == "Closing Date");
  closed_date = closed_date ? closed_date.dateMillis : null;
  let pending_date = dates.find(
    (item) => item.dateType == "Contract Accepted Date"
  );
  pending_date = pending_date ? pending_date.dateMillis : null;
  let listing_start_date = dates.find(
    (item) => item.dateType == "Listing Start Date"
  );
  listing_start_date = listing_start_date
    ? listing_start_date.dateMillis
    : null;
  let listing_end_date = dates.find(
    (item) => item.dateType == "Listing End Date"
  );
  listing_end_date = listing_end_date ? listing_end_date.dateMillis : null;
  let brokerage_fee = commissions?.baseCommission?.netBrokerCommission || 0;
  let status = "";
  if (data.status.name == "Closed File - ONLY CLOSING TO CHANGE THIS STATUS") {
    status = "Closed";
  }
  else if (data.status.name == "Closed - Incomplete File") {
    status = "Closed";
  }else{
    status = data.status.name;
  }
  let teamName = team ? team.name : "";
  return await supabase
    .from("total-brokerage")
    .update({
      "Transaction Type": data.represent,
      "Agent First Name": agent_first,
      "Agent Last Name": agent_last,
      "Sale's Price": sales_price,
      "Gross Commission Income": gross_commission,
      "Pending Date": pending_date ? new Date(pending_date) : null,
      "Closed Date": closed_date ? new Date(closed_date) : null,
      "Transaction Fee": null,
      "Team Name": teamName,
      "Listing Start Date": listing_start_date
        ? new Date(listing_start_date)
        : null,
      "Listing End Date": listing_end_date ? new Date(listing_end_date) : null,
      "Brokerage Fee": brokerage_fee,
      "status": status,
      "last_modified": new Date(),
    })
    .eq("Transaction ID", data.id)
    .then((data) => {
      console.log("inside updateTransaction", data.data);
      return data;
    });
}

app.post("/createOrUpdate", async (req, res) => {
  const fetchData = async  () => {
  let transaction_data = req.body;
  if (Object.keys(transaction_data).length !== 0) {
    if (transaction_data.eventType == "TRANSACTION_CREATED") {
      console.log("inside transaction created", transaction_data.results[0].id);
      let transaction = await getTransaction(transaction_data.results[0].id);
      let id = await supabase
        .from("total-brokerage")
        .select("*")
        .eq("Transaction ID", transaction_data.results[0].id);
      if (id.data.length == 0) {
        createTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      } else {
        updateTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      }
    } else if (
      (transaction_data.eventType == "TRANSACTION_DATE_MODIFIED" ||
        transaction_data.eventType == "TRANSACTION_DATE_ADDED" ||
        transaction_data.eventType == "TRANSACTION_DATE_REMOVED") &&
      transaction_data.results[0].transaction
    ) {
      console.log(
        "inside transaction date modified",
        transaction_data.results[0].transaction.key
      );

      let transaction = await getTransaction(
        transaction_data.results[0].transaction.key
      );
      let id = await supabase
        .from("total-brokerage")
        .select("*")
        .eq("Transaction ID", transaction_data.results[0].transaction.key);
      if (id.data.length > 0) {
        updateTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      } else {
        createTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      }
    } else if (
      transaction_data.eventType == "TRANSACTION_GENERAL_MODIFIED" &&
      transaction_data.results[0].id
    ) {
      console.log(
        "inside transaction general modified",
        transaction_data.results[0].id
      );

      let transaction = await getTransaction(transaction_data.results[0].id);
      let id = await supabase
        .from("total-brokerage")
        .select("*")
        .eq("Transaction ID", transaction_data.results[0].id);
      if (id.data.length > 0) {
        updateTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      } else {
        createTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      }
    } else if (
      transaction_data.eventType == "TRANSACTION_STATUS_MODIFIED" &&
      transaction_data.results[0].transaction
    ) {
      console.log(
        "inside transaction status modified",
        transaction_data.results[0].transaction.id
      );

      let transaction = await getTransaction(
        transaction_data.results[0].transaction.id
      );
      let id = await supabase
        .from("total-brokerage")
        .select("*")
        .eq("Transaction ID", transaction_data.results[0].transaction.id);
      if (id.data.length > 0) {
        updateTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      } else {
        createTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      }
    } else if (
      transaction_data.eventType == "TRANSACTION_FINANCIALS_MODIFIED" &&
      transaction_data.results[0].transaction
    ) {
      console.log(
        "inside transaction financials modified",
        transaction_data.results[0].transaction.key
      );

      let transaction = await getTransaction(
        transaction_data.results[0].transaction.key
      );
      let id = await supabase
        .from("total-brokerage")
        .select("*")
        .eq("Transaction ID", transaction_data.results[0].transaction.key);
      if (id.data.length > 0) {
        updateTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      } else {
        createTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      }
    } else if (
      transaction_data.eventType == "TRANSACTION_PROPERTY_MODIFIED" &&
      transaction_data.results[0].transaction
    ) {
      console.log(
        "inside transaction property modified",
        transaction_data.results[0].transaction.key
      );

      let transaction = await getTransaction(
        transaction_data.results[0].transaction.key
      );
      let id = await supabase
        .from("total-brokerage")
        .select("*")
        .eq("Transaction ID", transaction_data.results[0].transaction.key);
      if (id.data.length > 0) {
        updateTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      } else {
        createTransaction(
          transaction[0],
          transaction[1],
          transaction[2],
          transaction[4],
          transaction[3],
          transaction[5]
        ).then((data) => res.send(data));
      }
    } else {
      res.send("No data found");
    }
  } else {
    res.send("No data found");
  }

};
const debouncedFetchData = debounce(fetchData, 8000); // debounce for 8 seconds
debouncedFetchData();
});
app.get("/", (req, res) => {
  res.send("Hello World");
});


app.listen(process.env.PORT || 3000, () =>
  console.log("Example app is listening on port 3000.")
);c
