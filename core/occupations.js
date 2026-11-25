const categories = {
  Trucking: {Income:['Linehaul','Fuel surcharge','Fuel reimbursement','Detention / layover','Detention','Layover','Bonus','Other income'],Expense:['Diesel','DEF','Lease payment','Truck interest','Dispatch fees','Repairs & maintenance','Insurance','Tolls & permits','Other expense'],Transfer:['Escrow contribution','Escrow release','Maintenance escrow contribution','Maintenance escrow release','Tire escrow contribution','Tire escrow release','Advance repayment','Advance received','Truck principal','Buyout reserve','Owner transfer']},
  Mechanic: {Income:['Labor','Parts billed','Service call','Mileage charge','Other income'],Expense:['Parts purchased','Shop supplies','Tool rental','Insurance','Shop rent','Subcontract labor','Other expense'],Transfer:['Owner transfer','Equipment reserve','Sales tax collected']}
};
for(const trade of ['General contractor','Other business']){
  categories[trade]={Income:['Services','Sales','Other income'],Expense:['Supplies','Equipment','Insurance','Office rent','Advertising','Other expense'],Transfer:['Owner transfer','Reserve']};
}
