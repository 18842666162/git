/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// ============================================================================================================================
// write() - genric write variable into ledger
//
// Shows Off PutState() - writting a key/value into the ledger
//
// Inputs - Array of strings
//    0   ,    1
//   key  ,  value
//  "abc" , "test"
// ============================================================================================================================
func write(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var key, value string
	var err error
	fmt.Println("starting write")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2. key of the variable and value to set")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	key = args[0] //rename for funsies
	value = args[1]
	err = stub.PutState(key, []byte(value)) //write the variable into the ledger
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end write")
	return shim.Success(nil)
}

// ============================================================================================================================
// delete_marble() - remove a marble from state and from marble index
//
// Shows Off DelState() - "removing"" a key/value from the ledger
//
// Inputs - Array of strings
//      0      ,         1
//     id      ,  authed_by_company
// "m999999999", "united marbles"
// ============================================================================================================================
func delete_marble(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	fmt.Println("starting delete_marble")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	// input sanitation
	err := sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	id := args[0]
	authed_by_company := args[1]

	// get the marble
	marble, err := get_marble(stub, id)
	if err != nil {
		fmt.Println("Failed to find marble by id " + id)
		return shim.Error(err.Error())
	}

	// check authorizing company (see note in set_owner() about how this is quirky)
	if marble.Owner.Company != authed_by_company {
		return shim.Error("The company '" + authed_by_company + "' cannot authorize deletion for '" + marble.Owner.Company + "'.")
	}

	// remove the marble
	err = stub.DelState(id) //remove the key from chaincode state
	if err != nil {
		return shim.Error("Failed to delete state")
	}

	fmt.Println("- end delete_marble")
	return shim.Success(nil)
}

// ============================================================================================================================
// Init Marble - create a new marble, store into chaincode state
//
// Shows off building a key's JSON value manually
//
// Inputs - Array of strings
//      0      ,    1  ,  2  ,      3          ,       4			,5
//     id      ,  color, size,     owner id    ,  authing company	,value
// "m999999999", "blue", "35", "o9999999999999", "united marbles"	100
// ============================================================================================================================
func init_marble(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting init_marble gaidong")

	if len(args) != 6 {
		return shim.Error("Incorrect number of arguments. Expecting 6")
	}

	//input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	id := args[0]
	color := strings.ToLower(args[1])
	owner_id := args[3]
	authed_by_company := args[4]
	size, err := strconv.Atoi(args[2])
	value := args[5]
	status := 2
	if err != nil {
		return shim.Error("3rd argument must be a numeric string")
	}

	//check if new owner exists
	owner, err := get_owner(stub, owner_id)
	if err != nil {
		fmt.Println("Failed to find owner - " + owner_id)
		return shim.Error(err.Error())
	}

	//check authorizing company (see note in set_owner() about how this is quirky)
	if owner.Company != authed_by_company {
		return shim.Error("The company '" + authed_by_company + "' cannot authorize creation for '" + owner.Company + "'.")
	}

	//check if marble id already exists
	marble, err := get_marble(stub, id)
	if err == nil {
		fmt.Println("This marble already exists - " + id)
		fmt.Println(marble)
		return shim.Error("This marble already exists - " + id) //all stop a marble by this id exists
	}

	//build the marble json string manually
	str := `{
		"docType":"marble",
		"id": "` + id + `",
		"color": "` + color + `",
		"size": ` + strconv.Itoa(size) + `,
		"value": ` + value + `,
		"status": ` + strconv.Itoa(status) + `,
		"want":"",
		"owner": {
			"id": "` + owner_id + `",
			"username": "` + owner.Username + `",
			"company": "` + owner.Company + `"
		}
	}`
	err = stub.PutState(id, []byte(str)) //store marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end init_marble @@")
	return shim.Success(nil)
}

// ============================================================================================================================
// Init Owner - create a new owner aka end user, store into chaincode state
//
// Shows off building key's value from GoLang Structure
//
// Inputs - Array of Strings
//           0     ,     1   ,   2				,3
//      owner id   , username, company			,password
// "o9999999999999",     bob", "united marbles"	,"123456"
// ============================================================================================================================
func init_owner(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting init_owner gaidong")

	if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4")
	}

	//input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	var owner Owner
	owner.ObjectType = "marble_owner"
	owner.Id = args[0]
	owner.Username = strings.ToLower(args[1])
	owner.Password = args[3]
	owner.Company = args[2]
	owner.Status = true
	owner.Identity = 1
	owner.Credit = 0.00
	fmt.Println(owner)

	//check if user already exists
	_, err = get_owner(stub, owner.Id)
	if err == nil {
		fmt.Println("This owner already exists - " + owner.Id)
		return shim.Error("This owner already exists - " + owner.Id)
	}

	//store user
	ownerAsBytes, _ := json.Marshal(owner)      //convert to array of bytes
	err = stub.PutState(owner.Id, ownerAsBytes) //store owner by its Id
	if err != nil {
		fmt.Println("Could not store user")
		return shim.Error(err.Error())
	}

	fmt.Println("- end init_owner marble")
	return shim.Success(nil)
}

// ============================================================================================================================
// Set Owner on Marble
//
// Shows off GetState() and PutState()
//
// Inputs - Array of Strings
//       0     ,        1      ,        2
//  marble id  ,  to owner id  , company that auth the transfer
// "m999999999", "o99999999999", united_mables"
// ============================================================================================================================
func set_owner(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting set_owner")

	// this is quirky
	// todo - get the "company that authed the transfer" from the certificate instead of an argument
	// should be possible since we can now add attributes to the enrollment cert
	// as is.. this is a bit broken (security wise), but it's much much easier to demo! holding off for demos sake

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	var marble_id = args[0]
	var new_owner_id = args[1]
	var authed_by_company = args[2]
	fmt.Println(marble_id + "->" + new_owner_id + " - |" + authed_by_company)

	// check if user already exists
	owner, err := get_owner(stub, new_owner_id)
	if err != nil {
		return shim.Error("This owner does not exist - " + new_owner_id)
	}

	// get marble's current state
	marbleAsBytes, err := stub.GetState(marble_id)
	if err != nil {
		return shim.Error("Failed to get marble")
	}
	res := Marble{}
	json.Unmarshal(marbleAsBytes, &res) //un stringify it aka JSON.parse()

	// check authorizing company
	if res.Owner.Company != authed_by_company {
		return shim.Error("The company '" + authed_by_company + "' cannot authorize transfers for '" + res.Owner.Company + "'.")
	}

	// transfer the marble
	res.Owner.Id = new_owner_id //change the owner
	res.Owner.Username = owner.Username
	res.Owner.Company = owner.Company
	jsonAsBytes, _ := json.Marshal(res)       //convert to array of bytes
	err = stub.PutState(args[0], jsonAsBytes) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end set owner")
	return shim.Success(nil)
}

// ============================================================================================================================
// 测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试测试
//
// 测试转移资产时加入价值与积分等
//
// Inputs - Array of Strings
//       0     ,        1      ,        2                        , 3
//  marble id  ,  to owner id  , company that auth the transfer  , send owner id
// "m999999999", "o99999999999", "united_mables"				 , "o123456789"
// ============================================================================================================================
func test_set_owner(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting test_set_owner")

	// this is quirky
	// todo - get the "company that authed the transfer" from the certificate instead of an argument
	// should be possible since we can now add attributes to the enrollment cert
	// as is.. this is a bit broken (security wise), but it's much much easier to demo! holding off for demos sake

	if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	var marble_id = args[0]
	var new_owner_id = args[1]
	var authed_by_company = args[2]
	var send_owner_id = args[3]
	fmt.Println(marble_id + "->" + new_owner_id + " - |" + authed_by_company + " - |" + send_owner_id)

	// check if user already exists
	owner, err := get_owner(stub, new_owner_id)
	if err != nil {
		return shim.Error("This owner does not exist - " + new_owner_id)
	}

	send_owner, err := get_owner(stub, send_owner_id)
	if err != nil {
		return shim.Error("This send_owner does not exist - " + new_owner_id)
	}

	// get marble's current state
	marbleAsBytes, err := stub.GetState(marble_id)
	if err != nil {
		return shim.Error("Failed to get marble")
	}

	res := Marble{}
	json.Unmarshal(marbleAsBytes, &res) //un stringify it aka JSON.parse()

	//发送者
	//s_owner := Owner{}
	//json.Unmarshal(s_ownerAsBytes, &s_owner)
	//接收者
	//g_owner := Owner{}
	//json.Unmarshal(g_ownerAsBytes, &g_owner)

	//check authorizing send_owner_id
	if res.Owner.Id != send_owner_id {
		return shim.Error("The send_owner not this marble!")
	}

	if res.Status != 1 {
		return shim.Error("The marble not auth")
	}
	// check authorizing company
	if res.Owner.Company != authed_by_company {
		return shim.Error("The company '" + authed_by_company + "' cannot authorize transfers for '" + res.Owner.Company + "'.")
	}
	var value float64 = res.Value //获取大理石的价值
	// var send_owner_integral float64 = 0.00
	// var to_owner_integral float64 = 0.00
	// if value != 0 {
	// var a float64 = 1.123456
	// get_f, err := Two(a)
	// if err != nil {
	// 	return shim.Error("Two function false")
	// }
	// fmt.Println(get_f)
	send_owner_credit, err := Two(value * 0.10) //发送资产者获得的积分
	if err != nil {
		return shim.Error("Two function false")
	}
	to_owner_credit, err := Two(value * 0.05) //接收资产者获得的积分
	if err != nil {
		return shim.Error("Two function false")
	}
	// }

	// transfer the marble
	res.Owner.Id = new_owner_id //change the owner
	res.Owner.Username = owner.Username
	res.Owner.Company = owner.Company
	jsonAsBytes, _ := json.Marshal(res)       //convert to array of bytes
	err = stub.PutState(args[0], jsonAsBytes) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	//修改发送者的积分
	send_owner.Credit = send_owner.Credit + send_owner_credit
	jsonAsBytes_s, _ := json.Marshal(send_owner) //convert to array of bytes
	err = stub.PutState(args[3], jsonAsBytes_s)  //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}
	//修改接收者的积分
	owner.Credit = owner.Credit + to_owner_credit
	jsonAsBytes_g, _ := json.Marshal(owner)     //convert to array of bytes
	err = stub.PutState(args[1], jsonAsBytes_g) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end test set owner")
	return shim.Success(nil)
}

// ============================================================================================================================
// Disable Marble Owner
//
// Shows off PutState()
//
// Inputs - Array of Strings
//       0     ,        1
//  owner id       , company that auth the transfer
// "o9999999999999", "united_mables"
// ============================================================================================================================
func disable_owner(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting disable_owner")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	var owner_id = args[0]
	var authed_by_company = args[1]

	// get the marble owner data
	owner, err := get_owner(stub, owner_id)
	if err != nil {
		return shim.Error("This owner does not exist - " + owner_id)
	}

	// check authorizing company
	if owner.Company != authed_by_company {
		return shim.Error("The company '" + authed_by_company + "' cannot change another companies marble owner")
	}

	// disable the owner
	owner.Status = false
	jsonAsBytes, _ := json.Marshal(owner)     //convert to array of bytes
	err = stub.PutState(args[0], jsonAsBytes) //rewrite the owner
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end disable_owner")
	return shim.Success(nil)
}

//*************************************** write TEST***********************************************************

func approval_marble(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	var err error

	fmt.Println("starting approval_marble ...")

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	//input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	marble_id := args[0]

	marble, err := get_marble(stub, marble_id)
	if err != nil {
		fmt.Println("This marble not exists - " + marble_id)
		return shim.Error("This marble not exists - " + marble_id)
	}

	if marble.Status != 2 {
		fmt.Println("This marble status not is 2 - ")
		return shim.Error("This marble status not is 2 - ")
	}
	marble.Status = 1
	marbleAsBytes, _ := json.Marshal(marble)      //convert to array of bytes
	err = stub.PutState(marble.Id, marbleAsBytes) //store user by its Id
	if err != nil {
		fmt.Println("XXXXXXXXXXXXXXXXXXXXXX")
		return shim.Error(err.Error())
	}

	fmt.Println("- end approval_marble")
	return shim.Success(nil)

}

func owner_identity(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	var err error
	fmt.Println("starting owner_identity ...")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	//input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	owner_id := args[0]

	owner, err := get_owner(stub, owner_id)
	if err != nil {
		fmt.Println("This user not exists - " + owner_id)
		return shim.Error("This user not exists - " + owner_id)
	}
	owner.Id = args[0]
	owner.Identity = 2

	ownerAsBytes, _ := json.Marshal(owner)      //convert to array of bytes
	err = stub.PutState(owner.Id, ownerAsBytes) //store user by its Id
	if err != nil {
		fmt.Println("XXXXXXXXXXXXXXXXXXXXXX")
		return shim.Error(err.Error())
	}

	fmt.Println("- end owner_identity")
	return shim.Success(nil)

}

// func register(stub shim.ChaincodeStubInterface, args []string) pb.Response {
// 	var err error
// 	fmt.Println("starting register ...")

// 	if len(args) != 3 {
// 		return shim.Error("Incorrect number of arguments. Expecting 3")
// 	}

// 	//input sanitation
// 	err = sanitize_arguments(args)
// 	if err != nil {
// 		return shim.Error(err.Error())
// 	}

// 	var user User
// 	user.ObjectType = "marble_user"
// 	user.Id = args[0]
// 	user.Username = strings.ToLower(args[1])
// 	user.Password = args[2]
// 	user.Enabled = true
// 	fmt.Println(user)

// 	//check if user already exists
// 	_, err = get_user(stub, user.Id)
// 	if err == nil {
// 		fmt.Println("This user already exists - " + user.Id)
// 		return shim.Error("This user already exists - " + user.Id)
// 	}

// 	//store user
// 	userAsBytes, _ := json.Marshal(user)      //convert to array of bytes
// 	err = stub.PutState(user.Id, userAsBytes) //store user by its Id
// 	if err != nil {
// 		fmt.Println("Could not store user")
// 		return shim.Error(err.Error())
// 	}

// 	fmt.Println("- end register marble")
// 	return shim.Success(nil)
// }

////////////////////////////////////////////////////////////////////////////////////////////////////////////

//商品上架   can shu marbles_id,want_color
func on_shelf(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting on_shelf")

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	var marble_id = args[0]
	var want_color = args[1]
	var auction_id = args[2]

	// get marble's current state
	marbleAsBytes, err := stub.GetState(marble_id)
	if err != nil {
		return shim.Error("Failed to get marble")
	}
	res := Marble{}
	json.Unmarshal(marbleAsBytes, &res) //un stringify it aka JSON.parse()

	// check authorizing company
	if res.Status != 1 {
		return shim.Error("the marble not auth")
	}

	// transfer the marble
	res.Status = 3 //change the owner

	id := auction_id
	// status := 1

	str := `{
		"docType":"auction",
		"id": "` + id + `",
		"want": "` + want_color + `",
		"status": "1",
		"marble": {
			"id": "` + marble_id + `",
			"color": "` + res.Color + `",
			"value": "100"
		}
	}`
	err = stub.PutState(id, []byte(str)) //store marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	jsonAsBytes, _ := json.Marshal(res)       //convert to array of bytes
	err = stub.PutState(args[0], jsonAsBytes) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end on_shelf")
	return shim.Success(nil)
}

//商品下架   can shu marbles_id,want_color
func lower_shelf(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting lower_shelf")

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	var marble_id = args[0]
	var owner_id = args[1]
	var auction_id = args[2]

	// get marble's current state
	marbleAsBytes, err := stub.GetState(marble_id)
	if err != nil {
		return shim.Error("Failed to get marble")
	}
	res := Marble{}
	json.Unmarshal(marbleAsBytes, &res) //un stringify it aka JSON.parse()

	// check authorizing company
	if res.Status != 3 {
		return shim.Error("the marble not auth")
	}

	if res.Owner.Id != owner_id {
		return shim.Error("the owner not auth")
	}

	// transfer the marble
	res.Status = 1 //change the owner

	auctionAsBytes, err := stub.GetState(auction_id)
	if err != nil {
		return shim.Error("Failed to get auction")
	}
	res_ := Auction{}
	json.Unmarshal(auctionAsBytes, &res_)

	res_.Status = 2
	jsonAsBytes_, _ := json.Marshal(res_)
	err = stub.PutState(auction_id, jsonAsBytes_) //store marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	jsonAsBytes, _ := json.Marshal(res)       //convert to array of bytes
	err = stub.PutState(args[0], jsonAsBytes) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end lower_shelf")
	return shim.Success(nil)
}

//物品交换 shu  a_id,marble_id
func exchange(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error
	fmt.Println("starting exchange")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	var auction_id = args[0]  //交易id
	var ex_marble_id = args[1]

	// get marble's current state
	marbleAsBytes, err := stub.GetState(ex_marble_id)
	if err != nil {
		return shim.Error("Failed to get marble")
	}
	res := Marble{}

	json.Unmarshal(marbleAsBytes, &res) //un stringify it aka JSON.parse()

	auctionAsBytes, err := stub.GetState(auction_id)
	if err != nil {
		return shim.Error("Failed to get marble")
	}
	res_ := Auction{}

	json.Unmarshal(auctionAsBytes, &res_)

	if res.Status != 1 {
		return shim.Error("this auction is expried")
	}

	if res.Color != res_.Want {
		return shim.Error("this marble is not auction want")
	}

	buy_owner_id := res.Owner.Id
	buy_owner_name := res.Owner.Username
	buy_owner_company := res.Owner.Company

	sell_marble_id := res_.Marble.Id

	smarbleAsBytes, err := stub.GetState(sell_marble_id)
	if err != nil {
		return shim.Error("Failed to get marble")
	}
	sres := Marble{}

	json.Unmarshal(smarbleAsBytes, &sres)

	sell_owner_id := sres.Owner.Id
	sell_owner_name := sres.Owner.Username
	sell_owner_company := sres.Owner.Company

	res.Owner.Id = sell_owner_id
	res.Owner.Username = sell_owner_name
	res.Owner.Company = sell_owner_company

	jsonAsBytes, _ := json.Marshal(res)            //convert to array of bytes
	err = stub.PutState(ex_marble_id, jsonAsBytes) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}
	sres.Status = 1
	sres.Owner.Id = buy_owner_id
	sres.Owner.Username = buy_owner_name
	sres.Owner.Company = buy_owner_company

	jsonAsBytes_, _ := json.Marshal(sres)             //convert to array of bytes
	err = stub.PutState(sell_marble_id, jsonAsBytes_) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	res_.Status = 1

	jsonAsBytes_auction, _ := json.Marshal(res_)         //convert to array of bytes
	err = stub.PutState(auction_id, jsonAsBytes_auction) //rewrite the marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("end exchenge")

	return shim.Success(jsonAsBytes_auction)

	// if res.Status != 1 {
	// 	return shim.Error("the marble not auth")
	// }

	// // transfer the marble
	// res.Status = 3 //change the owner

	// id := "a1"
	// // status := 1

	// str := `{
	// 	"docType":"auction",
	// 	"id": "` + id + `",
	// 	"want": "` + want_color + `",
	// 	"status": "1",
	// 	"marble": {
	// 		"id": "` + marble_id + `",
	// 		"color": "` + res.Color + `",
	// 		"value": "100"
	// 	}
	// }`
	// err = stub.PutState(id, []byte(str)) //store marble with id as key
	// if err != nil {
	// 	return shim.Error(err.Error())
	// }

	// jsonAsBytes, _ := json.Marshal(res)       //convert to array of bytes
	// err = stub.PutState(args[0], jsonAsBytes) //rewrite the marble with id as key
	// if err != nil {
	// 	return shim.Error(err.Error())
	// }

	// fmt.Println("- end on_shelf")
	// return shim.Success(nil)
}
