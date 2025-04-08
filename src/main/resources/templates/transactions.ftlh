<!DOCTYPE html>
<html lang="en">
<#include "common/head.ftlh">
<body>
<#include "common/bodyStart.ftlh">
<main class="container">
    <#include "common/menu.ftlh">
  <section>
    <h2>Transactions Overview</h2>
    <table class="table table-hover">
      <tr>
        <th>Date</th>
        <th>Account</th>
        <th class="text-right">Amount (HBAR)</th>
        <th class="text-right">HBAR-USD</th>
        <th class="text-right">Amount (USD)</th>
        <th>Remarks</th>
        <th class="text-right">Total Amount (HBAR)</th>
        <th class="text-right">Total Amount (USD)</th>
      </tr>
        <#list transactions as transaction>
          <tr>
            <td>${transaction.timestamp()}</td>
            <td>${transaction.accountId()}</td>
            <td class="text-right">${transaction.hbarAmount()}</td>
            <td class="text-right">${transaction.exchangeRate()}</td>
            <td class="text-right">${transaction.amount()}</td>
            <td>${transaction.note()}</td>
            <td class="text-right">${transaction.hbarBalanceAfterTransaction()}</td>
            <td class="text-right"><strong>${transaction.balanceAfterTransaction()}</strong></td>
          </tr>
        </#list>
    </table>
  </section>
</main>
</body>
</html>